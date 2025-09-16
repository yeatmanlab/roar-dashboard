CREATE TABLE "app"."task_variant_parameters" (
	"task_variant_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."task_variant_parameters" ADD CONSTRAINT "task_variant_parameters_task_variant_id_task_variants_id_fk" FOREIGN KEY ("task_variant_id") REFERENCES "app"."task_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_variant_parameters_name_variant_id_idx" ON "app"."task_variant_parameters" USING btree ("task_variant_id","name");

-- Manual edit: 
-- Add trigger to update task_variant_parameters.updated_at
DROP TRIGGER IF EXISTS task_variant_parameters_set_updated_at ON app.task_variant_parameters;
CREATE TRIGGER task_variant_parameters_set_updated_at
BEFORE INSERT OR UPDATE ON app.task_variant_parameters
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
