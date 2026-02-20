ALTER TABLE "app"."runs" ADD COLUMN "aborted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."runs" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."runs" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "app"."runs" ADD CONSTRAINT "runs_deleted_by_required" CHECK ("app"."runs"."deleted_at" IS NULL OR "app"."runs"."deleted_by" IS NOT NULL);