CREATE TABLE "app"."courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."courses" ADD CONSTRAINT "courses_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_org_name_lower_uniqIdx" ON "app"."courses" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "courses_name_lower_idx" ON "app"."courses" USING btree (("name"));


-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS courses_set_updated_at ON app.courses;
CREATE TRIGGER courses_set_updated_at
BEFORE INSERT OR UPDATE ON app.courses
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();