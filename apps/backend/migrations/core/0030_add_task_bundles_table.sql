CREATE TABLE "app"."task_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_bundles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "task_bundles_slug_lower_idx" ON "app"."task_bundles" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "task_bundles_name_lower_idx" ON "app"."task_bundles" USING btree (lower("name"));

-- Manual edit: 
-- Add trigger to update task_bundles.updated_at
DROP TRIGGER IF EXISTS task_bundles_set_updated_at ON app.task_bundles;
CREATE TRIGGER task_bundles_set_updated_at
BEFORE UPDATE ON app.task_bundles
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
