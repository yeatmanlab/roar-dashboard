CREATE TABLE "app"."administration_orgs" (
	"administration_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administration_orgs_pkey" PRIMARY KEY("administration_id","org_id")
);
--> statement-breakpoint
ALTER TABLE "app"."administration_orgs" ADD CONSTRAINT "administration_orgs_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."administration_orgs" ADD CONSTRAINT "administration_orgs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "app"."orgs"("id") ON DELETE no action ON UPDATE no action;

-- Manual edit: 
-- Add trigger to update administration_orgs.updated_at
DROP TRIGGER IF EXISTS administration_orgs_set_updated_at ON app.administration_orgs;
CREATE TRIGGER administration_orgs_set_updated_at
BEFORE INSERT OR UPDATE ON app.administration_orgs
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();