CREATE TABLE "app"."administration_groups" (
	"administration_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administration_groups_pkey" PRIMARY KEY("administration_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "app"."administration_groups" ADD CONSTRAINT "administration_groups_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."administration_groups" ADD CONSTRAINT "administration_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "app"."groups"("id") ON DELETE no action ON UPDATE no action;

-- Manual edit: 
-- Add trigger to update administration_groups.updated_at
DROP TRIGGER IF EXISTS administration_groups_set_updated_at ON app.administration_groups;
CREATE TRIGGER administration_groups_set_updated_at
BEFORE UPDATE ON app.administration_groups
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();