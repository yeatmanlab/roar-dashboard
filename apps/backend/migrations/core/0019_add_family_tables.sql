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
CREATE TABLE "app"."user_families" (
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"role" "app"."user_role" NOT NULL,
	"joined_on" timestamp with time zone DEFAULT now() NOT NULL,
	"left_on" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_families_pk" PRIMARY KEY("user_id","family_id")
);
--> statement-breakpoint
ALTER TABLE "app"."user_families" ADD CONSTRAINT "user_families_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_families" ADD CONSTRAINT "user_families_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_families_user_idx" ON "app"."user_families" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_families_family_idx" ON "app"."user_families" USING btree ("family_id");

-- Manual edit: 
-- Add trigger to update families.updated_at
DROP TRIGGER IF EXISTS families_set_updated_at ON app.families;
CREATE TRIGGER families_set_updated_at
BEFORE INSERT OR UPDATE ON app.families
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();


-- Add trigger to update user_families.updated_at
DROP TRIGGER IF EXISTS user_families_set_updated_at ON app.user_families;
CREATE TRIGGER user_families_set_updated_at
BEFORE INSERT OR UPDATE ON app.user_families
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();