CREATE TABLE "app"."administration_task_variants" (
	"administration_id" uuid NOT NULL,
	"task_variant_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"conditions_assignment" jsonb,
	"conditions_requirements" jsonb,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administration_task_variants_pkey" PRIMARY KEY("administration_id","task_variant_id")
);
--> statement-breakpoint
ALTER TABLE "app"."administration_task_variants" ADD CONSTRAINT "administration_task_variants_administration_id_administrations_id_fk" FOREIGN KEY ("administration_id") REFERENCES "app"."administrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."administration_task_variants" ADD CONSTRAINT "administration_task_variants_task_variant_id_task_variants_id_fk" FOREIGN KEY ("task_variant_id") REFERENCES "app"."task_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "administration_task_variants_administration_id_order_index_idx" ON "app"."administration_task_variants" USING btree ("administration_id","order_index");--> statement-breakpoint
CREATE INDEX "administration_task_variants_task_variant_id_idx" ON "app"."administration_task_variants" USING btree ("task_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "administration_task_variants_admin_order_unique_idx" ON "app"."administration_task_variants" USING btree ("administration_id","order_index");
--> statement-breakpoint


-- =============================================================================
-- Manual Edits
-- =============================================================================

-- Add trigger to update administration_task_variants.updated_at
DROP TRIGGER IF EXISTS administration_task_variants_set_updated_at ON app.administration_task_variants;
CREATE TRIGGER administration_task_variants_set_updated_at
BEFORE UPDATE ON app.administration_task_variants
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();