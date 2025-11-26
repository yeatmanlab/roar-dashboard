CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_pid" text NOT NULL,
	"auth_provider" "app"."auth_provider"[] DEFAULT '{}'::"app"."auth_provider"[],
	"auth_id" text,
	"username" text,
	"email" text,
	"user_type" "app"."user_type",
	"dob" date,
	"grade" "app"."grade",
	"school_level" "app"."school_level" GENERATED ALWAYS AS (app.get_school_level_from_grade(grade)) STORED,
	"status_ell" boolean,
	"status_frl" "app"."free_reduced_lunch_status",
	"status_iep" boolean,
	"student_id" text,
	"sis_id" text,
	"state_id" text,
	"local_id" text,
	"gender" text,
	"race" text,
	"hispanic_ethnicity" boolean,
	"home_language" text,
	"exclude_from_research" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_assessmentPid_unique" UNIQUE("assessment_pid"),
	CONSTRAINT "users_authId_unique" UNIQUE("auth_id"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_dob_in_past" CHECK ("app"."users"."dob" IS NULL OR "app"."users"."dob" <= now()::date)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uniqIdx" ON "app"."users" USING btree (lower("email")) WHERE "app"."users"."email" IS NOT NULL;
--> statement-breakpoint

-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS users_set_updated_at ON app.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON app.users
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();