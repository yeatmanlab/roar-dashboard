CREATE TABLE "app"."rostering_run_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rostering_run_id" uuid NOT NULL,
	"entity_type" "app"."rostering_entity_type" NOT NULL,
	"provider_id" text NOT NULL,
	"status" "app"."rostering_entity_status" NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."rostering_run_entities" ADD CONSTRAINT "rostering_run_entities_rostering_run_id_rostering_runs_id_fk" FOREIGN KEY ("rostering_run_id") REFERENCES "app"."rostering_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rostering_run_entities_run_id_idx" ON "app"."rostering_run_entities" USING btree ("rostering_run_id");--> statement-breakpoint
CREATE INDEX "rostering_run_entities_provider_id_idx" ON "app"."rostering_run_entities" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "rostering_run_entities_run_status_idx" ON "app"."rostering_run_entities" USING btree ("rostering_run_id","status");