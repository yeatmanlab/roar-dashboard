ALTER TABLE "app"."user_classes" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "app"."user_groups" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "app"."user_orgs" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "app"."user_role";--> statement-breakpoint
CREATE TYPE "app"."user_role" AS ENUM('administrator', 'aide', 'counselor', 'district_administrator', 'guardian', 'parent', 'principal', 'proctor', 'relative', 'site_administrator', 'student', 'system_administrator', 'teacher');--> statement-breakpoint
ALTER TABLE "app"."user_classes" ALTER COLUMN "role" SET DATA TYPE "app"."user_role" USING "role"::"app"."user_role";--> statement-breakpoint
ALTER TABLE "app"."user_groups" ALTER COLUMN "role" SET DATA TYPE "app"."user_role" USING "role"::"app"."user_role";--> statement-breakpoint
ALTER TABLE "app"."user_orgs" ALTER COLUMN "role" SET DATA TYPE "app"."user_role" USING "role"::"app"."user_role";