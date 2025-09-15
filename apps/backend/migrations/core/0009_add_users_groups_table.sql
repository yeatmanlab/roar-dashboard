CREATE TABLE "app"."users_groups" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "app"."user_role" NOT NULL,
	"enrollment_start" timestamp with time zone NOT NULL,
	"enrollment_end" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_groups_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "app"."users_groups" ADD CONSTRAINT "users_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users_groups" ADD CONSTRAINT "users_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_groups_user_idx" ON "app"."users_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_groups_group_idx" ON "app"."users_groups" USING btree ("group_id");

-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS users_groups_set_updated_at ON app.users_groups;
CREATE TRIGGER users_groups_set_updated_at
BEFORE INSERT OR UPDATE ON app.users_groups
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();