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
CREATE UNIQUE INDEX "rostering_provider_ids_provider_id_unique_idx" ON "app"."rostering_provider_ids" USING btree ("provider_type","provider_id");--> statement-breakpoint
CREATE INDEX "rostering_provider_ids_entity_idx" ON "app"."rostering_provider_ids" USING btree ("entity_type","entity_id");