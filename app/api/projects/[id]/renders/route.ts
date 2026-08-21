import type { NextRequest } from "next/server";
import { ensureDatabase } from "../../../../../db/bootstrap";
import { getD1, getR2 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { generateRenderAsset, renderViews, type RenderView } from "../../../../../lib/render-service";
import type { RenderPromptPayload } from "../../../../../lib/style-brief";
import { enqueueTask, failTask, finishTask, retryTask, updateTaskProgress } from "../../../../../lib/task-queue";

type Context = { params: Promise<{ id: string }> };
type RenderTaskRow = { id: string; inputVersionId: string; status: string; progress: number; payloadJson: string; errorCode: string | null; errorMessage: string | null; retries: number; startedAt: string | null; createdAt: string; updatedAt: string };

export async function GET(request: NextRequest, context: Context) {
  try {
    await ensureDatabase(); const user = await requireApiUser(request); const { id } = await context.params; const db = getD1();
    const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.id).first();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const task = await db.prepare(`SELECT id, input_version_id AS inputVersionId, status, progress, payload_json AS payloadJson, error_code AS errorCode, error_message AS errorMessage, retries, started_at AS startedAt, created_at AS createdAt, updated_at AS updatedAt FROM generation_tasks WHERE project_id = ? AND type = 'RENDER_GENERATE' ORDER BY created_at DESC LIMIT 1`).bind(id).first<RenderTaskRow>();
    if (task?.status === "RUNNING" && task.startedAt && Date.now() - Date.parse(task.startedAt) > 120_000) {
      const now = new Date().toISOString(); await db.prepare("UPDATE generation_tasks SET status = 'TIMED_OUT', error_code = 'RENDER_TIMEOUT', error_message = '效果图生成超过 120 秒，请重试。', finished_at = ?, updated_at = ? WHERE id = ? AND status = 'RUNNING'").bind(now, now, task.id).run(); task.status = "TIMED_OUT"; task.errorCode = "RENDER_TIMEOUT"; task.errorMessage = "效果图生成超过 120 秒，请重试。";
    }
    const assets = await db.prepare(`SELECT id, task_id AS taskId, version_id AS versionId, view, content_type AS contentType, prompt_json AS promptJson, provider, selected, created_at AS createdAt FROM render_assets WHERE project_id = ? ORDER BY created_at DESC`).bind(id).all();
    return Response.json({ task: task ? publicTask(task) : null, assets: assets.results.map(asset => ({ ...asset, selected: Boolean(asset.selected), url: `/api/render-assets/${asset.id}` })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    await ensureDatabase(); const user = await requireApiUser(request); const { id } = await context.params; const body = await request.json() as { action?: "process" | "retry" | "regenerate" | "select"; taskId?: string; assetId?: string; views?: RenderView[] };
    const db = getD1(); const project = await db.prepare("SELECT id, current_version_id AS currentVersionId FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.id).first<{ id: string; currentVersionId: string | null }>();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    if (body.action === "select") {
      if (!body.assetId) return Response.json({ error: "ASSET_REQUIRED" }, { status: 400 });
      const asset = await db.prepare("SELECT id FROM render_assets WHERE id = ? AND project_id = ? AND owner_id = ?").bind(body.assetId, id, user.id).first();
      if (!asset) return Response.json({ error: "RENDER_ASSET_NOT_FOUND" }, { status: 404 });
      await db.batch([db.prepare("UPDATE render_assets SET selected = 0 WHERE project_id = ?").bind(id), db.prepare("UPDATE render_assets SET selected = 1 WHERE id = ?").bind(body.assetId), db.prepare("UPDATE projects SET status = 'RENDER_CONFIRMED', current_stage = 'RENDER', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id)]);
      return Response.json({ selectedAssetId: body.assetId, status: "CONFIRMED" });
    }
    let task: RenderTaskRow | null = null;
    if (body.action === "retry") {
      if (!body.taskId) return Response.json({ error: "TASK_REQUIRED" }, { status: 400 });
      task = await ownedTask(db, id, body.taskId); if (!task) return Response.json({ error: "RENDER_TASK_NOT_FOUND" }, { status: 404 });
      await retryTask(task.id); task = await ownedTask(db, id, task.id);
    } else if (body.action === "regenerate") {
      const latest = await db.prepare(`SELECT id, input_version_id AS inputVersionId, payload_json AS payloadJson FROM generation_tasks WHERE project_id = ? AND type = 'RENDER_GENERATE' ORDER BY created_at DESC LIMIT 1`).bind(id).first<{ id: string; inputVersionId: string; payloadJson: string }>();
      if (!latest) return Response.json({ error: "STYLE_VERSION_REQUIRED" }, { status: 409 });
      const payload = { ...JSON.parse(latest.payloadJson), views: validViews(body.views) }; const created = await enqueueTask({ projectId: id, type: "RENDER_GENERATE", inputVersionId: latest.inputVersionId, payload, idempotencyKey: `RENDER_GENERATE:${id}:${latest.inputVersionId}:regen:${crypto.randomUUID()}` });
      task = await ownedTask(db, id, (created as { id: string }).id);
    } else {
      if (!body.taskId) return Response.json({ error: "TASK_REQUIRED" }, { status: 400 });
      task = await ownedTask(db, id, body.taskId);
    }
    if (!task) return Response.json({ error: "RENDER_TASK_NOT_FOUND" }, { status: 404 });
    if (task.status === "SUCCEEDED") return Response.json({ task: publicTask(task), message: "RENDER_ALREADY_COMPLETE" });
    if (!task.inputVersionId) return Response.json({ error: "STYLE_VERSION_REQUIRED" }, { status: 409 });
    const payload = JSON.parse(task.payloadJson) as RenderPromptPayload & { views?: RenderView[] }; const views = validViews(payload.views);
    try {
      for (let index = 0; index < views.length; index++) {
        const view = views[index]; await updateTaskProgress(task.id, 10 + index * (75 / views.length));
        const existing = await db.prepare("SELECT id FROM render_assets WHERE task_id = ? AND view = ?").bind(task.id, view).first(); if (existing) continue;
        const generated = await generateRenderAsset(payload, view); const assetId = crypto.randomUUID(); const extension = generated.contentType.includes("svg") ? "svg" : "png"; const objectKey = `projects/${id}/renders/${task.id}/${view.toLowerCase()}.${extension}`; const now = new Date().toISOString();
        await getR2().put(objectKey, generated.bytes, { httpMetadata: { contentType: generated.contentType }, customMetadata: { projectId: id, versionId: task.inputVersionId, view } });
        await db.prepare("INSERT INTO render_assets (id, project_id, task_id, version_id, owner_id, view, object_key, content_type, prompt_json, provider, status, selected, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', 0, ?)").bind(assetId, id, task.id, task.inputVersionId, user.id, view, objectKey, generated.contentType, JSON.stringify(generated.prompt), generated.provider, now).run();
      }
      const rows = await db.prepare("SELECT id, view FROM render_assets WHERE task_id = ? ORDER BY created_at").bind(task.id).all(); await finishTask(task.id, { assetIds: rows.results.map(row => row.id), views });
      await db.prepare("UPDATE projects SET status = 'RENDER_REVIEW', current_stage = 'RENDER', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
      return Response.json({ task: { id: task.id, status: "SUCCEEDED", progress: 100 }, assets: rows.results }, { status: 201 });
    } catch (cause) {
      const message = cause instanceof Error && cause.name === "AbortError" ? "效果图接口超过 45 秒未响应。" : cause instanceof Error ? cause.message : "效果图生成失败"; const code = cause instanceof Error && cause.name === "AbortError" ? "IMAGE_PROVIDER_TIMEOUT" : "IMAGE_PROVIDER_FAILED"; await failTask(task.id, code, message); return Response.json({ error: code, message, retryable: true }, { status: 502 });
    }
  } catch (error) { return apiError(error); }
}

function validViews(views?: RenderView[]) { const selected = (views ?? renderViews).filter(view => renderViews.includes(view)); return selected.length >= 2 ? [...new Set(selected)] : [...renderViews]; }
function publicTask(task: RenderTaskRow) { return { id: task.id, inputVersionId: task.inputVersionId, status: task.status, progress: task.progress, errorCode: task.errorCode, errorMessage: task.errorMessage, retries: task.retries, createdAt: task.createdAt, updatedAt: task.updatedAt }; }
async function ownedTask(db: D1Database, projectId: string, taskId: string) { return db.prepare(`SELECT id, input_version_id AS inputVersionId, status, progress, payload_json AS payloadJson, error_code AS errorCode, error_message AS errorMessage, retries, started_at AS startedAt, created_at AS createdAt, updated_at AS updatedAt FROM generation_tasks WHERE id = ? AND project_id = ? AND type = 'RENDER_GENERATE'`).bind(taskId, projectId).first<RenderTaskRow>(); }
