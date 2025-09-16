CREATE TABLE "app"."user_assignment_progress" (
	"user_assignment_id" uuid NOT NULL,
	"task_variant_id" uuid NOT NULL,
	"progress" "app"."assignment_progress" NOT NULL,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_assignment_progress_pkey" PRIMARY KEY("user_assignment_id","task_variant_id")
);
--> statement-breakpoint
ALTER TABLE "app"."user_assignment_progress" ADD CONSTRAINT "user_assignment_progress_user_assignment_id_user_assignments_id_fk" FOREIGN KEY ("user_assignment_id") REFERENCES "app"."user_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_assignment_progress" ADD CONSTRAINT "user_assignment_progress_task_variant_id_task_variants_id_fk" FOREIGN KEY ("task_variant_id") REFERENCES "app"."task_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_assignments_progress_user_idx" ON "app"."user_assignment_progress" USING btree ("user_assignment_id");--> statement-breakpoint
CREATE INDEX "user_assignments_progress_task_variant_idx" ON "app"."user_assignment_progress" USING btree ("task_variant_id");--> statement-breakpoint
CREATE INDEX "user_assignment_progress_user_assignment_progress_idx" ON "app"."user_assignment_progress" USING btree ("user_assignment_id","progress");

-- Manual edit: 
-- Add trigger to update user_assignment_progress.updated_at
DROP TRIGGER IF EXISTS user_assignment_progress_set_updated_at ON app.user_assignment_progress;
CREATE TRIGGER user_assignment_progress_set_updated_at
BEFORE INSERT OR UPDATE ON app.user_assignment_progress
FOR EACH ROW
EXECUTE FUNCTION app.set_updated_at();