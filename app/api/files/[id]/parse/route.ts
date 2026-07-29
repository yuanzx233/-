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
      `SELECT f.id, f.project_id AS projectId, f.object_key AS objectKey, f.status
       FROM file_assets f JOIN projects p ON p.id = f.project_id
       WHERE f.id = ? AND p.owner_id = ?`,
    ).bind(id, user.id).first<{ id: string; projectId: string; objectKey: string; status: string }>();
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
    const model = parseDxf(await object.text());
    const now = new Date().toISOString();
    await getD1().prepare(
      "UPDATE file_assets SET status = 'PARSED', metadata_json = ?, updated_at = ? WHERE id = ?",
    ).bind(JSON.stringify({ dxf: model }), now, file.id).run();
    await getD1().prepare(
      "UPDATE projects SET status = 'SITE_REVIEW', current_stage = 'SITE', updated_at = ? WHERE id = ?",
    ).bind(now, file.projectId).run();
    await finishTask(task.id, { fileId: file.id, stats: model.stats });
    return Response.json({ fileId: file.id, taskId: task.id, model });
  } catch (error) {
    return apiError(error);
  }
}
