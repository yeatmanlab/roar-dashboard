CREATE TABLE "app"."run_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"assessment_stage" text,
	"audio_feedback" text,
	"block" text,
	"block_id" text,
	"button_response" integer,
	"corpus_id" text,
	"correct" integer,
	"correct_response" text,
	"difficulty" text,
	"goal" text,
	"internal_node_id" text,
	"item" text,
	"item_id" text,
	"keyboard_response" text,
	"realpseudo" text,
	"response" text,
	"response_input" text,
	"response_source" text,
	"response_time_ms" integer,
	"start_time" text,
	"start_time_unix" integer,
	"stim" text,
	"stimulus" text,
	"stimulus_rule" text,
	"story" boolean,
	"subtask" text,
	"theta_estimate" double precision,
	"theta_estimate2" double precision,
	"theta_std_err" double precision,
	"theta_std_err2" double precision,
	"thetas" jsonb,
	"theta_std_errs" jsonb,
	"item_parameters" jsonb,
	"time_elapsed" integer,
	"timezone" text,
	"trial_num_block" integer,
	"trial_num_total" integer,
	"trial_index" integer,
	"trial_type" text,
	"truefalse" text,
	"word" text,
	"metadata" jsonb,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."run_trials" ADD CONSTRAINT "run_trials_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "app"."runs"("id") ON DELETE no action ON UPDATE no action;


-- Manual edit:
-- Add trigger to update run_trials.updated_at
DROP TRIGGER IF EXISTS run_trials_set_updated_at ON app.run_trials;
CREATE TRIGGER run_trials_set_updated_at
BEFORE UPDATE ON app.run_trials
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();