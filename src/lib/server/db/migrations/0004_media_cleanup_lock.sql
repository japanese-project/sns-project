CREATE TABLE `media_cleanup_lock` (
	`key` text PRIMARY KEY NOT NULL,
	`locked_at` integer NOT NULL,
	`owner` text NOT NULL
);
