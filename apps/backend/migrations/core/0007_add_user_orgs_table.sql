CREATE TABLE "app"."user_orgs" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" "app"."user_role" NOT NULL,
	"enrollment_start" timestamp with time zone NOT NULL,
	"enrollment_end" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_orgs_pk" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
ALTER TABLE "app"."user_orgs" ADD CONSTRAINT "user_orgs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_orgs" ADD CONSTRAINT "user_orgs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_orgs_user_idx" ON "app"."user_orgs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_orgs_org_idx" ON "app"."user_orgs" USING btree ("org_id");


-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS user_orgs_set_updated_at ON app.user_orgs;
CREATE TRIGGER user_orgs_set_updated_at
BEFORE INSERT OR UPDATE ON app.user_orgs
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();