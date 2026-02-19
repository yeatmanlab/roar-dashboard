ALTER TABLE "app"."runs" RENAME COLUMN "best_run" TO "use_for_reporting";--> statement-breakpoint
DROP INDEX "app"."runs_user_best_run_idx";--> statement-breakpoint
CREATE INDEX "runs_user_reporting_run_idx" ON "app"."runs" USING btree ("user_id") WHERE "app"."runs"."use_for_reporting" = true;