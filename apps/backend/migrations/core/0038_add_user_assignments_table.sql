CREATE TABLE "app"."user_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"administration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."user_assignments" ADD CONSTRAINT "user_assignments_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_assignments" ADD CONSTRAINT "user_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_assignments_user_administration_uniqIdx" ON "app"."user_assignments" USING btree ("user_id","administration_id");--> statement-breakpoint
CREATE INDEX "user_assignments_user_idx" ON "app"."user_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_assignments_administration_idx" ON "app"."user_assignments" USING btree ("administration_id");

-- Manual edit: 
-- Add trigger to update user_assignments.updated_at
DROP TRIGGER IF EXISTS user_assignments_set_updated_at ON app.user_assignments;
CREATE TRIGGER user_assignments_set_updated_at
BEFORE INSERT OR UPDATE ON app.user_assignments
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();