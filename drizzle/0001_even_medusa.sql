CREATE TABLE `render_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text NOT NULL,
	`version_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`view` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`prompt_json` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'READY' NOT NULL,
	`selected` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `generation_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `project_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `render_assets_object_key_idx` ON `render_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `render_assets_project_idx` ON `render_assets` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `render_assets_task_idx` ON `render_assets` (`task_id`);