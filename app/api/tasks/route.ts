import type { NextRequest } from "next/server";
import { getD1 } from "../../../db/runtime";
import { apiError, requireApiUser } from "../../../lib/api-auth";
import { enqueueTask, taskTypes, type TaskType } from "../../../lib/task-queue";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const rows = await getD1().prepare(
      `SELECT t.* FROM generation_tasks t JOIN projects p ON p.id = t.project_id
       WHERE p.owner_id = ? ORDER BY t.created_at DESC LIMIT 100`,
    ).bind(user.id).all();
    return Response.json({ tasks: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    const body = await request.json() as {
      projectId?: string;
      type?: TaskType;
      inputVersionId?: string;
      payload?: unknown;
      idempotencyKey?: string;
    };
    if (!body.projectId || !body.type || !taskTypes.includes(body.type)) {
      return Response.json({ error: "INVALID_TASK" }, { status: 400 });
    }
    const project = await getD1().prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
      .bind(body.projectId, user.id).first();
    if (!project) return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const task = await enqueueTask({
      projectId: body.projectId,
      type: body.type,
      inputVersionId: body.inputVersionId,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey ?? `${body.type}:${body.projectId}:${body.inputVersionId ?? "none"}`,
    });
    return Response.json({ task }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
