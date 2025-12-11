CREATE TABLE "app"."families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update families.updated_at
DROP TRIGGER IF EXISTS families_set_updated_at ON app.families;
CREATE TRIGGER families_set_updated_at
BEFORE UPDATE ON app.families
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();