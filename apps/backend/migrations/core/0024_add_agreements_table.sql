CREATE TABLE "app"."agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"agreement_type" "app"."agreement_type" NOT NULL,
	"requires_majority_age" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agreements_name_lower_idx" ON "app"."agreements" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "agreements_type_idx" ON "app"."agreements" USING btree ("agreement_type");


-- Manual edit: 
-- Add trigger to update agreements.updated_at
DROP TRIGGER IF EXISTS agreements_set_updated_at ON app.agreements;
CREATE TRIGGER agreements_set_updated_at
BEFORE INSERT OR UPDATE ON app.agreements
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
