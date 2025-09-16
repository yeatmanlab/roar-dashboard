CREATE TABLE "app"."groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"group_type" "app"."group_type" NOT NULL,
	"parent_group_id" uuid,
	"location_address_line1" text,
	"location_address_line2" text,
	"location_city" text,
	"location_state_province" text,
	"location_postal_code" text,
	"location_country" varchar(2),
	"location_lat_long" "point",
	"rostering_ended" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."groups" ADD CONSTRAINT "groups_parent_group_id_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "app"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_parent_idx" ON "app"."groups" USING btree ("parent_group_id");--> statement-breakpoint
CREATE INDEX "groups_name_lower_idx" ON "app"."groups" USING btree (("name"));


-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS groups_set_updated_at ON app.groups;
CREATE TRIGGER groups_set_updated_at
BEFORE UPDATE ON app.groups
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();