import type { NextRequest } from "next/server";
import { getD1, getR2 } from "../../../../../db/runtime";
import { apiError, requireApiUser } from "../../../../../lib/api-auth";
import { parseDxf } from "../../../../../lib/dxf";
import { enqueueTask, finishTask } from "../../../../../lib/task-queue";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const file = await getD1().prepare(
      `SELECT f.id, f.project_id AS projectId, f.object_key AS objectKey, f.status,
              f.metadata_json AS metadataJson
       FROM file_assets f JOIN projects p ON p.id = f.project_id
       WHERE f.id = ? AND p.owner_id = ?`,
    ).bind(id, user.id).first<{ id: string; projectId: string; objectKey: string; status: string; metadataJson: string }>();
    if (!file) return Response.json({ error: "FILE_NOT_FOUND" }, { status: 404 });
    if (file.status !== "UPLOADED" && file.status !== "PARSED") {
      return Response.json({ error: "FILE_NOT_READY" }, { status: 409 });
    }
    const task = await enqueueTask({
      projectId: file.projectId,
      type: "DXF_PARSE",
      idempotencyKey: `dxf:${file.id}`,
      payload: { fileId: file.id },
    }) as { id: string };
    const object = await getR2().get(file.objectKey);
    if (!object) return Response.json({ error: "R2_OBJECT_NOT_FOUND" }, { status: 404 });
    const metadata = JSON.parse(file.metadataJson || "{}") as { sourceUnit?: "mm" | "cm" | "m"; siteInfo?: Record<string, unknown> };
    const source = await object.text();
    if (source.includes("\u0000")) return Response.json({ error: "DXF_BINARY_UNSUPPORTED" }, { status: 422 });
    const model = parseDxf(source, { unit: metadata.sourceUnit });
    const now = new Date().toISOString();
    await getD1().prepare(
      "UPDATE file_assets SET status = 'PARSED', metadata_json = ?, updated_at = ? WHERE id = ?",
    ).bind(JSON.stringify({ ...metadata, dxf: model }), now, file.id).run();
    await getD1().prepare(
      "UPDATE projects SET status = 'SITE_REVIEW', current_stage = 'SITE', updated_at = ? WHERE id = ?",
    ).bind(now, file.projectId).run();
    await finishTask(task.id, { fileId: file.id, stats: model.stats });
    return Response.json({ fileId: file.id, taskId: task.id, model, siteInfo: metadata.siteInfo ?? {} });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DXF_PARSE_FAILED";
    if (code.startsWith("DXF_")) return Response.json({ error: code }, { status: 422 });
    return apiError(error);
  }
}
