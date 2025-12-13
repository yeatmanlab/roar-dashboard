CREATE TABLE "app"."run_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"task_variant_id" uuid NOT NULL,
	"type" "app"."score_type" NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"assessment_stage" "app"."assessment_stage",
	"category_score" boolean,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."run_scores" ADD CONSTRAINT "run_scores_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "app"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "run_scores_run_id_idx" ON "app"."run_scores" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_scores_run_id_type_idx" ON "app"."run_scores" USING btree ("run_id","type");
--> statement-breakpoint


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update run_scores.updated_at
DROP TRIGGER IF EXISTS run_scores_set_updated_at ON app.run_scores;
CREATE TRIGGER run_scores_set_updated_at
BEFORE UPDATE ON app.run_scores
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();