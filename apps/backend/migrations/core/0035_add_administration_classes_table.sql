CREATE TABLE "app"."administration_classes" (
	"administration_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administration_classes_pkey" PRIMARY KEY("administration_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "app"."administration_classes" ADD CONSTRAINT "administration_classes_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."administration_classes" ADD CONSTRAINT "administration_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "app"."classes"("id") ON DELETE no action ON UPDATE no action;

-- Manual edit: 
-- Add trigger to update administration_classes.updated_at
DROP TRIGGER IF EXISTS administration_classes_set_updated_at ON app.administration_classes;
CREATE TRIGGER administration_classes_set_updated_at
BEFORE UPDATE ON app.administration_classes
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();