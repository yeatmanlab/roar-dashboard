CREATE TYPE "app"."assessment_stage" AS ENUM('practice', 'test');--> statement-breakpoint
CREATE TYPE "app"."score_type" AS ENUM('computed', 'raw');