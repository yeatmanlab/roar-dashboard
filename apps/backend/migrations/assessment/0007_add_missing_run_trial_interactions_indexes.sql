CREATE TYPE "app"."rostering_run_type" AS ENUM('full', 'incremental', 'retry');--> statement-breakpoint
ALTER TABLE "app"."run_trial_interactions" DROP CONSTRAINT "run_trial_interactions_trial_id_run_trials_id_fk";
--> statement-breakpoint
ALTER TABLE "app"."run_trial_interactions" ADD CONSTRAINT "run_trial_interactions_trial_id_run_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "app"."run_trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_trial_interactions_trial_id_idx" ON "app"."run_trial_interactions" USING btree ("trial_id");