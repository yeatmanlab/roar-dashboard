CREATE TYPE "app"."rostering_run_type" AS ENUM('full', 'incremental', 'retry');--> statement-breakpoint
ALTER TABLE "app"."rostering_runs" ADD COLUMN "run_type" "app"."rostering_run_type" NOT NULL;