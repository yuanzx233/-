import type { NextRequest } from "next/server";
import { getD1 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { generatePlanCandidates, planTemplates } from "../../../../../lib/plan-generator";
import type { RequirementSubmission } from "../../../../../lib/requirements";
import { assembleRenderPrompt, validateStyleSelection, type StyleSelection } from "../../../../../lib/style-brief";
import { enqueueTask } from "../../../../../lib/task-queue";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request); const { id } = await context.params; const body = await request.json() as { action?: "generate" | "confirm" | "style"; planId?: string; planVersionId?: string; style?: Partial<StyleSelection> };
    const db = getD1();
    const project = await db.prepare("SELECT id, current_version_id AS currentVersionId FROM projects WHERE id = ? AND owner_id = ?").bind(id, user.id).first<{ id: string; currentVersionId: string | null }>();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    if (body.action === "confirm") {
      const current = await db.prepare("SELECT data_json AS dataJson FROM project_versions WHERE id = ? AND project_id = ? AND stage = 'PLAN'").bind(project.currentVersionId, id).first<{ dataJson: string }>();
      if (!current) return Response.json({ error: "PLAN_VERSION_NOT_FOUND" }, { status: 404 });
      const data = JSON.parse(current.dataJson) as { plans: Array<{ id: string; templateId: string }>; selectedPlanId?: string; lockedAt?: string; lockedBy?: string };
      if (data.lockedAt) return Response.json({ error: "PLAN_VERSION_ALREADY_LOCKED", selectedPlanId: data.selectedPlanId }, { status: 409 });
      if (!data.plans.some(plan => plan.id === body.planId)) return Response.json({ error: "PLAN_NOT_FOUND" }, { status: 422 });
      const lockedAt = new Date().toISOString(); data.selectedPlanId = body.planId; data.lockedAt = lockedAt; data.lockedBy = user.id;
      await db.batch([db.prepare("UPDATE project_versions SET status = 'LOCKED', data_json = ? WHERE id = ? AND status = 'DRAFT'").bind(JSON.stringify(data), project.currentVersionId), db.prepare("UPDATE projects SET status = 'STYLE_DRAFT', current_stage = 'STYLE', updated_at = ? WHERE id = ?").bind(lockedAt, id)]);
      return Response.json({ selectedPlanId: body.planId, planVersionId: project.currentVersionId, status: "LOCKED", lockedAt });
    }
    if (body.action === "style") {
      if (!body.planVersionId || !body.style) return Response.json({ error: "STYLE_INPUT_REQUIRED" }, { status: 400 });
      const errors = validateStyleSelection(body.style); if (errors.length) return Response.json({ error: "INVALID_STYLE_SELECTION", errors }, { status: 422 });
      const locked = await db.prepare("SELECT data_json AS dataJson FROM project_versions WHERE id = ? AND project_id = ? AND stage = 'PLAN' AND status = 'LOCKED'").bind(body.planVersionId, id).first<{ dataJson: string }>();
      if (!locked) return Response.json({ error: "LOCKED_PLAN_REQUIRED" }, { status: 409 });
      const planData = JSON.parse(locked.dataJson) as { plans: Array<{ id: string; templateId: string }>; selectedPlanId?: string };
      const selectedPlan = planData.plans.find(plan => plan.id === planData.selectedPlanId); if (!selectedPlan) return Response.json({ error: "LOCKED_PLAN_SELECTION_MISSING" }, { status: 409 });
      const promptPayload = assembleRenderPrompt({ planVersionId: body.planVersionId, selectedPlanId: selectedPlan.id, templateId: selectedPlan.templateId, style: body.style as StyleSelection });
      const sequence = (await db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM project_versions WHERE project_id = ?").bind(id).first<{ sequence: number }>())?.sequence ?? 1;
      const styleVersionId = crypto.randomUUID(); const now = new Date().toISOString();
      await db.batch([db.prepare("INSERT INTO project_versions (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at) VALUES (?, ?, ?, ?, 'STYLE', 'CONFIRMED', ?, ?, ?)").bind(styleVersionId, id, body.planVersionId, sequence, JSON.stringify(promptPayload), user.id, now), db.prepare("UPDATE projects SET current_version_id = ?, status = 'RENDER_QUEUED', current_stage = 'STYLE', updated_at = ? WHERE id = ?").bind(styleVersionId, now, id)]);
      const task = await enqueueTask({ projectId: id, type: "RENDER_GENERATE", inputVersionId: styleVersionId, payload: promptPayload, idempotencyKey: `RENDER_GENERATE:${id}:${styleVersionId}` });
      return Response.json({ styleVersionId, promptPayload, task }, { status: 202 });
    }
    const lockedPlan = await db.prepare("SELECT id FROM project_versions WHERE project_id = ? AND stage = 'PLAN' AND status = 'LOCKED' ORDER BY sequence DESC LIMIT 1").bind(id).first();
    if (lockedPlan) return Response.json({ error: "PLAN_VERSION_LOCKED", message: "平面方案已锁定；如需修改，请基于锁定版本创建新版本。" }, { status: 409 });
    const requirement = await db.prepare("SELECT id, data_json AS dataJson FROM project_versions WHERE project_id = ? AND stage = 'REQUIREMENTS' ORDER BY sequence DESC LIMIT 1").bind(id).first<{ id: string; dataJson: string }>();
    if (!requirement) return Response.json({ error: "REQUIREMENTS_NOT_FOUND" }, { status: 409 });
    const plans = generatePlanCandidates(JSON.parse(requirement.dataJson) as RequirementSubmission); if (!plans.length) return Response.json({ error: "NO_PLAN_FITS_SITE", message: "没有模板能完整放入当前可建设范围，请调整面积需求或复核控制线与保留对象。" }, { status: 422 }); const sequence = (await db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM project_versions WHERE project_id = ?").bind(id).first<{ sequence: number }>())?.sequence ?? 1; const versionId = crypto.randomUUID(); const now = new Date().toISOString();
    await db.batch([db.prepare("INSERT INTO project_versions (id, project_id, parent_id, sequence, stage, status, data_json, created_by, created_at) VALUES (?, ?, ?, ?, 'PLAN', 'DRAFT', ?, ?, ?)").bind(versionId, id, requirement.id, sequence, JSON.stringify({ templateCount: planTemplates.length, plans }), user.id, now), db.prepare("UPDATE projects SET current_version_id = ?, status = 'PLAN_REVIEW', current_stage = 'PLAN', updated_at = ? WHERE id = ?").bind(versionId, now, id)]);
    return Response.json({ version: { id: versionId, sequence }, templateCount: planTemplates.length, plans }, { status: 201 });
  } catch (error) { return apiError(error); }
}
