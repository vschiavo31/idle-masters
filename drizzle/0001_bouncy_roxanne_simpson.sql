CREATE TABLE `characters` (
	`user_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`nickname_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_nickname_key_unique` ON `characters` (`nickname_key`);