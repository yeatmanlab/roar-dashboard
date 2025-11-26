CREATE TABLE "app"."run_trial_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trial_id" uuid NOT NULL,
	"interaction_type" "app"."trial_interaction_type" NOT NULL,
	"time_ms" integer NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."run_trial_interactions" ADD CONSTRAINT "run_trial_interactions_trial_id_run_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "app"."run_trials"("id") ON DELETE no action ON UPDATE no action;


-- Manual edit:
-- Add trigger to update run_trial_interactions.updated_at
DROP TRIGGER IF EXISTS run_trial_interactions_set_updated_at ON app.run_trial_interactions;
CREATE TRIGGER run_trial_interactions_set_updated_at
BEFORE UPDATE ON app.run_trial_interactions
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();