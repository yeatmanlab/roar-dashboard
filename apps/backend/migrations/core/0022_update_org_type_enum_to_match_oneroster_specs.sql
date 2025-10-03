ALTER TABLE "app"."orgs" ALTER COLUMN "org_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "app"."org_type";--> statement-breakpoint
CREATE TYPE "app"."org_type" AS ENUM('national', 'state', 'local', 'district', 'school', 'department');--> statement-breakpoint
ALTER TABLE "app"."orgs" ALTER COLUMN "org_type" SET DATA TYPE "app"."org_type" USING "org_type"::"app"."org_type";