CREATE TABLE "app"."user_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agreement_version_id" uuid NOT NULL,
	"agreement_timestamp" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."user_agreements" ADD CONSTRAINT "user_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_agreements" ADD CONSTRAINT "user_agreements_agreement_version_id_agreement_versions_id_fk" FOREIGN KEY ("agreement_version_id") REFERENCES "app"."agreement_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_agreements_user_idx" ON "app"."user_agreements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_agreements_user_agreement_idx" ON "app"."user_agreements" USING btree ("user_id","agreement_version_id");--> statement-breakpoint
CREATE INDEX "user_agreements_agreement_version_idx" ON "app"."user_agreements" USING btree ("agreement_version_id");
--> statement-breakpoint


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update user_agreements.updated_at
DROP TRIGGER IF EXISTS user_agreements_set_updated_at ON app.user_agreements;
CREATE TRIGGER user_agreements_set_updated_at
BEFORE UPDATE ON app.user_agreements
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();