CREATE TABLE "app"."rostering_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rostering_provider" "app"."rostering_provider" NOT NULL,
	"sync_started" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_ended" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "rostering_runs_provider_idx" ON "app"."rostering_runs" USING btree ("rostering_provider");--> statement-breakpoint
CREATE INDEX "rostering_runs_provider_running_idx" ON "app"."rostering_runs" USING btree ("rostering_provider") WHERE "app"."rostering_runs"."sync_ended" IS NULL;