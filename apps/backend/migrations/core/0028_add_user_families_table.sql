CREATE TABLE "app"."user_families" (
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"role" "app"."user_family_role" NOT NULL,
	"joined_on" timestamp with time zone DEFAULT now() NOT NULL,
	"left_on" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_families_pk" PRIMARY KEY("user_id","family_id"),
	CONSTRAINT "user_families_membership_dates_valid" CHECK ("app"."user_families"."left_on" IS NULL OR "app"."user_families"."joined_on" < "app"."user_families"."left_on")
);
--> statement-breakpoint
ALTER TABLE "app"."user_families" ADD CONSTRAINT "user_families_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_families" ADD CONSTRAINT "user_families_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "app"."families"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_families_family_idx" ON "app"."user_families" USING btree ("family_id");


-- Manual edit:
-- Add user_families_child_active_uniqIdx
-- Due to https://github.com/drizzle-team/drizzle-orm/issues/3349, the unique index cannot currently be declared inside
-- the users-families schema declaration and must be added here as a raw SQL migration.
CREATE UNIQUE INDEX IF NOT EXISTS user_families_child_active_uniqIdx
  ON app.user_families (user_id)
  WHERE role = 'child'::app.user_family_role AND left_on IS NULL;

-- Add trigger to update user_families.updated_at
DROP TRIGGER IF EXISTS user_families_set_updated_at ON app.user_families;
CREATE TRIGGER user_families_set_updated_at
BEFORE UPDATE ON app.user_families
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();