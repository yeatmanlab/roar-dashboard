CREATE TYPE "app"."rostering_entity_status" AS ENUM('enrolled', 'unenrolled', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "app"."rostering_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rostering_provider" "app"."rostering_provider" NOT NULL,
	"sync_started" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_ended" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."rostering_run_entities" (
	"rostering_run_id" uuid NOT NULL,
	"entity_type" "app"."rostering_entity_type" NOT NULL,
	"provider_id" text NOT NULL,
	"status" "app"."rostering_entity_status" NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."rostering_run_entities" ADD CONSTRAINT "rostering_run_entities_rostering_run_id_rostering_runs_id_fk" FOREIGN KEY ("rostering_run_id") REFERENCES "app"."rostering_runs"("id") ON DELETE no action ON UPDATE no action;