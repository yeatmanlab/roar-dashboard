CREATE TABLE "app"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"task_variant_id" uuid NOT NULL,
	"task_version" text,
	"administration_id" uuid NOT NULL,
	"assignment_id" uuid NOT NULL,
	"best_run" boolean DEFAULT false NOT NULL,
	"reliable_run" boolean DEFAULT false NOT NULL,
	"engagement_flags" jsonb,
	"metadata" jsonb,
	"exclude_from_research" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);


-- Manual edit: 
-- Add trigger to update runs.updated_at
DROP TRIGGER IF EXISTS runs_set_updated_at ON app.runs;
CREATE TRIGGER runs_set_updated_at
BEFORE UPDATE ON app.runs
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
