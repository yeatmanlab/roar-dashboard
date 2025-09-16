CREATE TABLE "app"."agreement_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"is_current" boolean NOT NULL,
	"locale" varchar(6) NOT NULL,
	"github_filename" text NOT NULL,
	"github_org_repo" text NOT NULL,
	"github_commit_sha" bigint NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "app"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agreement_versions_agreement_id_idx" ON "app"."agreement_versions" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "agreement_versions_current_idx" ON "app"."agreement_versions" USING btree ("is_current","agreement_id");--> statement-breakpoint
CREATE INDEX "agreement_versions_current_locale_idx" ON "app"."agreement_versions" USING btree ("is_current","locale","agreement_id");


-- Manual edit: 
-- Add trigger to update agreement_versions.updated_at
DROP TRIGGER IF EXISTS agreement_versions_set_updated_at ON app.agreement_versions;
CREATE TRIGGER agreement_versions_set_updated_at
BEFORE UPDATE ON app.agreement_versions
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
