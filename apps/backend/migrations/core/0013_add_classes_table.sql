CREATE TABLE "app"."classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"school_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"course_id" uuid,
	"class_type" "app"."class_type" NOT NULL,
	"number" text,
	"period" text,
	"term_id" uuid,
	"subjects" text[],
	"location" text,
	"grades" "app"."grade"[],
	"school_levels" "app"."school_level"[] GENERATED ALWAYS AS (app.get_school_levels_from_grades_array(grades)) STORED,
	"rostering_ended" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."classes" ADD CONSTRAINT "classes_school_id_orgs_id_fk" FOREIGN KEY ("school_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."classes" ADD CONSTRAINT "classes_district_id_orgs_id_fk" FOREIGN KEY ("district_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."classes" ADD CONSTRAINT "classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "app"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classes_school_name_lower_uniqIdx" ON "app"."classes" USING btree ("school_id",lower("name"));--> statement-breakpoint
CREATE INDEX "classes_name_lower_idx" ON "app"."classes" USING btree (lower("name"));

-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS classes_set_updated_at ON app.classes;
CREATE TRIGGER classes_set_updated_at
BEFORE UPDATE ON app.classes
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();