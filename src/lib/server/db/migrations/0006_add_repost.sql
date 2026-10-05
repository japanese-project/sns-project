-- drizzle-kit omits the ON DELETE action when it adds a foreign-key column with ALTER TABLE;
-- the cascade is added by hand so deleting a post also deletes its reposts (see schema/sns.ts).
ALTER TABLE `post` ADD `repost_of_id` text REFERENCES post(id) ON DELETE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX `post_repost_of_user_unique` ON `post` (`repost_of_id`,`user_id`);
