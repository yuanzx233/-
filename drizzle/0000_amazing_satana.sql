CREATE TABLE `file_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_id` text,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `project_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `file_assets_project_idx` ON `file_assets` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `file_assets_object_key_idx` ON `file_assets` (`object_key`);--> statement-breakpoint
CREATE TABLE `generation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`input_version_id` text,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`result_json` text,
	`error_code` text,
	`error_message` text,
	`retries` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_tasks_idempotency_idx` ON `generation_tasks` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `generation_tasks_queue_idx` ON `generation_tasks` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `generation_tasks_project_idx` ON `generation_tasks` (`project_id`);--> statement-breakpoint
CREATE TABLE `project_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_id` text,
	`sequence` integer NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_versions_sequence_idx` ON `project_versions` (`project_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `project_versions_project_idx` ON `project_versions` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`current_stage` text DEFAULT 'SITE' NOT NULL,
	`current_version_id` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE TABLE `upload_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `file_assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `upload_sessions_expiry_idx` ON `upload_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'OWNER' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);