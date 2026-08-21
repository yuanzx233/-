import { getD1 } from "../db/runtime";
import { canRetryTask } from "./task-policy";

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

export async function updateTaskProgress(id: string, progress: number) {
  const now = new Date().toISOString();
  await getD1().prepare("UPDATE generation_tasks SET status = 'RUNNING', progress = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?")
    .bind(Math.max(5, Math.min(95, Math.round(progress))), now, now, id).run();
}

export async function failTask(id: string, errorCode: string, errorMessage: string) {
  const now = new Date().toISOString();
  await getD1().prepare("UPDATE generation_tasks SET status = 'FAILED', error_code = ?, error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?")
    .bind(errorCode, errorMessage, now, now, id).run();
}

export async function retryTask(id: string, maximumRetries = 3) {
  const current = await getD1().prepare("SELECT status, retries FROM generation_tasks WHERE id = ?").bind(id).first<{ status: string; retries: number }>();
  if (!current || !canRetryTask(current.status, current.retries, maximumRetries)) return current;
  const now = new Date().toISOString();
  await getD1().prepare("UPDATE generation_tasks SET status = 'QUEUED', progress = 0, retries = retries + 1, error_code = NULL, error_message = NULL, available_at = ?, started_at = NULL, finished_at = NULL, updated_at = ? WHERE id = ? AND status IN ('FAILED', 'TIMED_OUT')")
    .bind(now, now, id).run();
  return getD1().prepare("SELECT * FROM generation_tasks WHERE id = ?").bind(id).first();
}
