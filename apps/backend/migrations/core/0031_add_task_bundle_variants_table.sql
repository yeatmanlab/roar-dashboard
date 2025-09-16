CREATE TABLE "app"."task_bundle_variants" (
	"task_bundle_id" uuid NOT NULL,
	"task_variant_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_bundle_variants_task_bundle_id_task_variant_id_pkey" PRIMARY KEY("task_bundle_id","task_variant_id")
);
--> statement-breakpoint
ALTER TABLE "app"."task_bundle_variants" ADD CONSTRAINT "task_bundle_variants_task_bundle_id_task_bundles_id_fk" FOREIGN KEY ("task_bundle_id") REFERENCES "app"."task_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."task_bundle_variants" ADD CONSTRAINT "task_bundle_variants_task_variant_id_task_variants_id_fk" FOREIGN KEY ("task_variant_id") REFERENCES "app"."task_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_bundle_variants_task_bundle_id_idx" ON "app"."task_bundle_variants" USING btree ("task_bundle_id");--> statement-breakpoint
CREATE INDEX "task_bundle_variants_task_variant_id_idx" ON "app"."task_bundle_variants" USING btree ("task_variant_id");--> statement-breakpoint
CREATE INDEX "task_bundle_variants_task_bundle_id_sort_order_idx" ON "app"."task_bundle_variants" USING btree ("task_bundle_id","sort_order");

-- Manual edit: 
-- Add trigger to update task_bundle_variants.updated_at
DROP TRIGGER IF EXISTS task_bundle_variants_set_updated_at ON app.task_bundle_variants;
CREATE TRIGGER task_bundle_variants_set_updated_at
BEFORE UPDATE ON app.task_bundle_variants
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();