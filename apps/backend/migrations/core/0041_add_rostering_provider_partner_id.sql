DROP INDEX "app"."rostering_provider_ids_provider_id_unique_idx";--> statement-breakpoint
ALTER TABLE "app"."rostering_provider_ids" ADD COLUMN "partner_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rostering_provider_ids_entity_unique_idx" ON "app"."rostering_provider_ids" USING btree ("provider_type","entity_type","entity_id");--> statement-breakpoint
ALTER TABLE "app"."rostering_provider_ids" DROP CONSTRAINT "rostering_provider_ids_pk";
--> statement-breakpoint
ALTER TABLE "app"."rostering_provider_ids" ADD CONSTRAINT "rostering_provider_ids_pk" PRIMARY KEY("provider_type","partner_id","provider_id");