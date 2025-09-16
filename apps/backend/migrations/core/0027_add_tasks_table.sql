CREATE TABLE "app"."tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"name_simple" text NOT NULL,
	"name_technical" text NOT NULL,
	"description" text,
	"image" text,
	"tutorial_video" text,
	"task_config" jsonb NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tasks_slug_lower_idx" ON "app"."tasks" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "tasks_name_lower_idx" ON "app"."tasks" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "tasks_name_simple_lower_idx" ON "app"."tasks" USING btree (lower("name_simple"));--> statement-breakpoint
CREATE INDEX "tasks_name_technical_lower_idx" ON "app"."tasks" USING btree (lower("name_technical"));--> statement-breakpoint

-- Manual edit: 
-- Add trigger to update tasks.updated_at
DROP TRIGGER IF EXISTS tasks_set_updated_at ON app.tasks;
CREATE TRIGGER tasks_set_updated_at
BEFORE INSERT OR UPDATE ON app.tasks
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();
