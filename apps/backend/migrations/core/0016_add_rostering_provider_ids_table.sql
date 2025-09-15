CREATE TABLE "app"."rostering_provider_ids" (
	"provider_type" "app"."rostering_provider" NOT NULL,
	"provider_id" text NOT NULL,
	"entity_type" "app"."rostering_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rostering_provider_ids_pk" PRIMARY KEY("provider_type","entity_type","entity_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rostering_provider_ids_uniqId" ON "app"."rostering_provider_ids" USING btree ("provider_type","provider_id");--> statement-breakpoint
CREATE INDEX "rostering_provider_ids_entity_idx" ON "app"."rostering_provider_ids" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "rostering_provider_ids_provider_idx" ON "app"."rostering_provider_ids" USING btree ("provider_type","provider_id");

-- Manual edit: 
-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS rostering_provider_ids_set_updated_at ON app.rostering_provider_ids;
CREATE TRIGGER rostering_provider_ids_set_updated_at
BEFORE INSERT OR UPDATE ON app.rostering_provider_ids
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();