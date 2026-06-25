CREATE TABLE `app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`max_concurrency` integer DEFAULT 2 NOT NULL,
	`default_output_dir` text,
	`last_used_preset_id` integer,
	FOREIGN KEY (`last_used_preset_id`) REFERENCES `presets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`config` text NOT NULL,
	`analysis_result` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`progress_stage` text,
	`error` text,
	`output_path` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_created_at_idx` ON `jobs` (`created_at`);--> statement-breakpoint
CREATE TABLE `presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
