ALTER TABLE "app"."users" ALTER COLUMN "user_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "app"."user_type";--> statement-breakpoint
CREATE TYPE "app"."user_type" AS ENUM('student', 'educator', 'caregiver', 'admin');--> statement-breakpoint
ALTER TABLE "app"."users" ALTER COLUMN "user_type" SET DATA TYPE "app"."user_type" USING "user_type"::"app"."user_type";--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;