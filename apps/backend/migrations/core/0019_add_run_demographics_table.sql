CREATE TABLE "app"."run_demographics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"status_ell" boolean,
	"status_frl" "app"."free_reduced_lunch_status",
	"status_iep" boolean,
	"gender" text,
	"race" text,
	"hispanic_ethnicity" boolean,
	"home_language" text,
	"age_in_months" integer,
	"grade" "app"."grade",
	"school_level" "app"."school_level" GENERATED ALWAYS AS (app.get_school_level_from_grade(grade)) STORED,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_demographics_runId_unique" UNIQUE("run_id")
);
--> statement-breakpoint


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update run_demographics.updated_at
DROP TRIGGER IF EXISTS run_demographics_set_updated_at ON app.run_demographics;
CREATE TRIGGER run_demographics_set_updated_at
BEFORE UPDATE ON app.run_demographics
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();