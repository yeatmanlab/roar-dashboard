ALTER TABLE "app"."users" ADD COLUMN "name_first" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "name_middle" text;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "name_last" text NOT NULL;