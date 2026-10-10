CREATE TABLE `follow_request` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "follow_request_no_self_follow" CHECK("follow_request"."follower_id" != "follow_request"."following_id")
);
--> statement-breakpoint
CREATE INDEX `follow_request_following_id_idx` ON `follow_request` (`following_id`);
--> statement-breakpoint
CREATE TABLE `media_cleanup_lock` (
	`key` text PRIMARY KEY NOT NULL,
	`locked_at` integer NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`notify_on_follow` integer DEFAULT true NOT NULL,
	`notify_on_like` integer DEFAULT true NOT NULL,
	`notify_on_comment` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
