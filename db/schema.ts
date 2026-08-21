import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("OWNER"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  address: text("address"),
  status: text("status").notNull().default("DRAFT"),
  currentStage: text("current_stage").notNull().default("SITE"),
  currentVersionId: text("current_version_id"),
  archivedAt: text("archived_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("projects_owner_idx").on(table.ownerId),
  index("projects_status_idx").on(table.status),
]);

export const projectVersions = sqliteTable("project_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  parentId: text("parent_id"),
  sequence: integer("sequence").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("DRAFT"),
  dataJson: text("data_json").notNull().default("{}"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("project_versions_sequence_idx").on(table.projectId, table.sequence),
  index("project_versions_project_idx").on(table.projectId),
]);

export const fileAssets = sqliteTable("file_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  versionId: text("version_id").references(() => projectVersions.id),
  ownerId: text("owner_id").notNull().references(() => users.id),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("PENDING"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("file_assets_project_idx").on(table.projectId),
  uniqueIndex("file_assets_object_key_idx").on(table.objectKey),
]);

export const uploadSessions = sqliteTable("upload_sessions", {
  token: text("token").primaryKey(),
  fileId: text("file_id").notNull().references(() => fileAssets.id),
  ownerId: text("owner_id").notNull().references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("upload_sessions_expiry_idx").on(table.expiresAt)]);

export const generationTasks = sqliteTable("generation_tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  type: text("type").notNull(),
  inputVersionId: text("input_version_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").notNull().default("QUEUED"),
  progress: integer("progress").notNull().default(0),
  payloadJson: text("payload_json").notNull().default("{}"),
  resultJson: text("result_json"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retries: integer("retries").notNull().default(0),
  availableAt: text("available_at").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("generation_tasks_idempotency_idx").on(table.idempotencyKey),
  index("generation_tasks_queue_idx").on(table.status, table.availableAt),
  index("generation_tasks_project_idx").on(table.projectId),
]);

export const renderAssets = sqliteTable("render_assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  taskId: text("task_id").notNull().references(() => generationTasks.id),
  versionId: text("version_id").notNull().references(() => projectVersions.id),
  ownerId: text("owner_id").notNull().references(() => users.id),
  view: text("view").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  promptJson: text("prompt_json").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("READY"),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("render_assets_object_key_idx").on(table.objectKey),
  index("render_assets_project_idx").on(table.projectId, table.createdAt),
  index("render_assets_task_idx").on(table.taskId),
]);
