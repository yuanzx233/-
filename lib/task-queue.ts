import { getD1 } from "../db/runtime";

export const taskTypes = ["DXF_PARSE", "PLAN_GENERATE", "RENDER_GENERATE", "MODEL_GENERATE", "DOCUMENT_GENERATE"] as const;
export type TaskType = (typeof taskTypes)[number];

export async function enqueueTask(input: {
  projectId: string;
  type: TaskType;
  inputVersionId?: string | null;
  payload?: unknown;
  idempotencyKey: string;
}) {
  const db = getD1();
  const existing = await db.prepare("SELECT * FROM generation_tasks WHERE idempotency_key = ?")
    .bind(input.idempotencyKey).first();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO generation_tasks
      (id, project_id, type, input_version_id, idempotency_key, status, progress, payload_json, retries, available_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'QUEUED', 0, ?, 0, ?, ?, ?)`,
  ).bind(
    id,
    input.projectId,
    input.type,
    input.inputVersionId ?? null,
    input.idempotencyKey,
    JSON.stringify(input.payload ?? {}),
    now,
    now,
    now,
  ).run();
  return db.prepare("SELECT * FROM generation_tasks WHERE id = ?").bind(id).first();
}

export async function claimNextTask() {
  const db = getD1();
  const now = new Date().toISOString();
  const task = await db.prepare(
    "SELECT * FROM generation_tasks WHERE status = 'QUEUED' AND available_at <= ? ORDER BY created_at LIMIT 1",
  ).bind(now).first<{ id: string }>();
  if (!task) return null;
  await db.prepare(
    "UPDATE generation_tasks SET status = 'RUNNING', progress = 5, started_at = ?, updated_at = ? WHERE id = ? AND status = 'QUEUED'",
  ).bind(now, now, task.id).run();
  return db.prepare("SELECT * FROM generation_tasks WHERE id = ?").bind(task.id).first();
}

export async function finishTask(id: string, result: unknown) {
  const now = new Date().toISOString();
  await getD1().prepare(
    "UPDATE generation_tasks SET status = 'SUCCEEDED', progress = 100, result_json = ?, finished_at = ?, updated_at = ? WHERE id = ?",
  ).bind(JSON.stringify(result), now, now, id).run();
}
