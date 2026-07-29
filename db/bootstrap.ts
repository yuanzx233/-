import { getD1 } from "./runtime";

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OWNER',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    current_stage TEXT NOT NULL DEFAULT 'SITE',
    current_version_id TEXT,
    archived_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id)",
  `CREATE TABLE IF NOT EXISTS project_versions (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    parent_id TEXT,
    sequence INTEGER NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    data_json TEXT NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE(project_id, sequence)
  )`,
  `CREATE TABLE IF NOT EXISTS file_assets (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    version_id TEXT REFERENCES project_versions(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS upload_sessions (
    token TEXT PRIMARY KEY NOT NULL,
    file_id TEXT NOT NULL REFERENCES file_assets(id),
    owner_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS generation_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL,
    input_version_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    progress INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT,
    error_code TEXT,
    error_message TEXT,
    retries INTEGER NOT NULL DEFAULT 0,
    available_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS generation_tasks_queue_idx ON generation_tasks(status, available_at)",
];

let ready: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!ready) {
    const db = getD1();
    ready = db.batch(statements.map((sql) => db.prepare(sql))).then(() => undefined);
  }
  return ready!;
}
