ALTER TYPE "app"."variant_status" RENAME TO "task_variant_status";--> statement-breakpoint
CREATE TABLE "app"."task_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" "app"."task_variant_status" NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."task_variants" ADD CONSTRAINT "task_variants_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "app"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_variants_task_id_idx" ON "app"."task_variants" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_variants_task_id_status_idx" ON "app"."task_variants" USING btree ("task_id","status");

-- Manual edit: 
-- Add trigger to update task_variants.updated_at
DROP TRIGGER IF EXISTS task_variants_set_updated_at ON app.task_variants;
CREATE TRIGGER task_variants_set_updated_at
BEFORE UPDATE ON app.task_variants
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
