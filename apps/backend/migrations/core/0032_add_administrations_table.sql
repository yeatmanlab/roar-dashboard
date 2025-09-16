CREATE TABLE "app"."administrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_public" text NOT NULL,
	"name_internal" text NOT NULL,
	"description" text NOT NULL,
	"date_start" date NOT NULL,
	"date_end" date NOT NULL,
	"is_ordered" boolean NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administrations_date_start_end_check" CHECK (("app"."administrations"."date_start" < "app"."administrations"."date_end"))
);
--> statement-breakpoint
ALTER TABLE "app"."administrations" ADD CONSTRAINT "administrations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "administrations_name_public_lower_idx" ON "app"."administrations" USING btree (lower("name_public"));--> statement-breakpoint
CREATE INDEX "administrations_name_internal_lower_idx" ON "app"."administrations" USING btree (lower("name_internal"));--> statement-breakpoint
CREATE INDEX "administrations_created_by_idx" ON "app"."administrations" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "administrations_date_start_idx" ON "app"."administrations" USING btree ("date_start");--> statement-breakpoint
CREATE INDEX "administrations_date_end_idx" ON "app"."administrations" USING btree ("date_end");--> statement-breakpoint
CREATE INDEX "administrations_date_start_end_idx" ON "app"."administrations" USING btree ("date_start","date_end");

-- Manual edit: 
-- Add trigger to update administrations.updated_at
DROP TRIGGER IF EXISTS administrations_set_updated_at ON app.administrations;
CREATE TRIGGER administrations_set_updated_at
BEFORE INSERT OR UPDATE ON app.administrations
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();