CREATE TABLE "app"."user_groups" (
  "user_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "role" "app"."user_role" NOT NULL,
  "enrollment_start" timestamp with time zone NOT NULL,
  "enrollment_end" timestamp with time zone,
  "updated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_groups_pk" PRIMARY KEY("user_id","group_id"),
  CONSTRAINT "user_groups_enrollment_dates_valid" CHECK ("app"."user_groups"."enrollment_end" IS NULL OR "app"."user_groups"."enrollment_start" < "app"."user_groups"."enrollment_end")
);
--> statement-breakpoint
ALTER TABLE "app"."user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_groups" ADD CONSTRAINT "user_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_groups_group_idx" ON "app"."user_groups" USING btree ("group_id");


-- Manual edit:
-- Add trigger to update user_groups.updated_at
DROP TRIGGER IF EXISTS user_groups_set_updated_at ON app.user_groups;
CREATE TRIGGER user_groups_set_updated_at
BEFORE UPDATE ON app.user_groups
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();