DROP INDEX "app"."runs_user_assignment_task_idx";--> statement-breakpoint
CREATE INDEX "runs_user_administration_task_idx" ON "app"."runs" USING btree ("user_id","administration_id","task_id");--> statement-breakpoint
ALTER TABLE "app"."runs" DROP COLUMN "assignment_id";