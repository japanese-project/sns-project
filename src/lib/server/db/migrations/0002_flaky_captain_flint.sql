ALTER TABLE `user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `user` ADD `interests` text;--> statement-breakpoint
ALTER TABLE `user` ADD `onboarded` integer DEFAULT false NOT NULL;