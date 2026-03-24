CREATE TABLE "app"."user_research_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exclude_from" timestamp with time zone NOT NULL,
	"exclude_until" timestamp with time zone NOT NULL,
	"excluded_by" uuid NOT NULL,
	"exclusion_reason" text NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_research_exclusions_date_range_check" CHECK ("app"."user_research_exclusions"."exclude_from" < "app"."user_research_exclusions"."exclude_until")
);
--> statement-breakpoint
ALTER TABLE "app"."users" ALTER COLUMN "assessment_pid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "rostering_ended" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."user_research_exclusions" ADD CONSTRAINT "user_research_exclusions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_research_exclusions" ADD CONSTRAINT "user_research_exclusions_excluded_by_users_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;

-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update updated_at on user_research_exclusions
DROP TRIGGER IF EXISTS user_research_exclusions_set_updated_at ON app.user_research_exclusions;
CREATE TRIGGER user_research_exclusions_set_updated_at
BEFORE UPDATE ON app.user_research_exclusions
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();