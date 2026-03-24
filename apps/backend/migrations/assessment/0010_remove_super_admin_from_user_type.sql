DROP TYPE "app"."user_type";--> statement-breakpoint
CREATE TYPE "app"."user_type" AS ENUM('student', 'educator', 'caregiver', 'admin');