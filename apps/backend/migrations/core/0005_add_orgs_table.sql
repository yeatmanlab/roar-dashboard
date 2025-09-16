CREATE TABLE "app"."orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"org_type" "app"."org_type" NOT NULL,
	"parent_org_id" uuid,
	"location_address_line1" text,
	"location_address_line2" text,
	"location_city" text,
	"location_state_province" text,
	"location_postal_code" text,
	"location_country" varchar(2),
	"location_lat_long" "point",
	"mdr_number" text,
	"nces_id" text,
	"state_id" text,
	"school_number" text,
	"is_rostering_root_org" boolean DEFAULT false NOT NULL,
	"rostering_provider" "app"."rostering_provider" NOT NULL,
	"rostering_provider_id" text,
	"rostering_ended" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orgs_mdrNumber_unique" UNIQUE("mdr_number"),
	CONSTRAINT "orgs_ncesId_unique" UNIQUE("nces_id"),
	CONSTRAINT "orgs_stateId_unique" UNIQUE("state_id"),
	CONSTRAINT "orgs_schoolNumber_unique" UNIQUE("school_number"),
	CONSTRAINT "orgs_abbreviation_format" CHECK ("app"."orgs"."abbreviation" ~ '^[A-Za-z0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "app"."orgs" ADD CONSTRAINT "orgs_parent_org_id_orgs_id_fk" FOREIGN KEY ("parent_org_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orgs_parent_idx" ON "app"."orgs" USING btree ("parent_org_id");--> statement-breakpoint
CREATE INDEX "orgs_parent_type_idx" ON "app"."orgs" USING btree ("parent_org_id","org_type");--> statement-breakpoint
CREATE INDEX "orgs_name_lower_idx" ON "app"."orgs" USING btree (("name"));


-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS orgs_set_updated_at ON app.orgs;
CREATE TRIGGER orgs_set_updated_at
BEFORE UPDATE ON app.orgs
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();