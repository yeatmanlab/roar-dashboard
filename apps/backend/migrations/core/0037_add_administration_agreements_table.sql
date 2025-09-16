CREATE TABLE "app"."administration_agreements" (
	"administration_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administration_agreements_pkey" PRIMARY KEY("administration_id","agreement_id")
);
--> statement-breakpoint
ALTER TABLE "app"."administration_agreements" ADD CONSTRAINT "administration_agreements_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."administration_agreements" ADD CONSTRAINT "administration_agreements_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "app"."agreements"("id") ON DELETE no action ON UPDATE no action;

-- Manual edit: 
-- Add trigger to update administration_agreements.updated_at
DROP TRIGGER IF EXISTS administration_agreements_set_updated_at ON app.administration_agreements;
CREATE TRIGGER administration_agreements_set_updated_at
BEFORE INSERT OR UPDATE ON app.administration_agreements
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();