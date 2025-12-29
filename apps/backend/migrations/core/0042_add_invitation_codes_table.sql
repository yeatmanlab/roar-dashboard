CREATE TABLE "app"."invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "invitation_codes_valid_range" CHECK ("app"."invitation_codes"."valid_to" IS NULL OR "app"."invitation_codes"."valid_to" > "app"."invitation_codes"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "app"."invitation_codes" ADD CONSTRAINT "invitation_codes_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_codes_group_idx" ON "app"."invitation_codes" USING btree ("group_id");


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update invitation_codes.updated_at
DROP TRIGGER IF EXISTS invitation_codes_set_updated_at ON app.invitation_codes;
CREATE TRIGGER invitation_codes_set_updated_at
BEFORE UPDATE ON app.invitation_codes
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();