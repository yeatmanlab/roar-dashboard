CREATE TYPE "app"."agreement_type" AS ENUM('tos', 'assent', 'consent');--> statement-breakpoint
CREATE TYPE "app"."assignment_progress" AS ENUM('assigned', 'started', 'completed');--> statement-breakpoint
CREATE TYPE "app"."auth_provider" AS ENUM('password', 'oidc.clever', 'oidc.classlink', 'oidc.nycps', 'google');--> statement-breakpoint
CREATE TYPE "app"."class_type" AS ENUM('homeroom', 'scheduled', 'other');--> statement-breakpoint
CREATE TYPE "app"."free_reduced_lunch_status" AS ENUM('Free', 'Reduced', 'Paid');--> statement-breakpoint
CREATE TYPE "app"."grade" AS ENUM('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'PreKindergarten', 'TransitionalKindergarten', 'Kindergarten', 'InfantToddler', 'Preschool', 'PostGraduate', 'Ungraded', 'Other');--> statement-breakpoint
CREATE TYPE "app"."group_type" AS ENUM('cohort', 'community', 'business');--> statement-breakpoint
CREATE TYPE "app"."org_type" AS ENUM('district', 'school', 'local', 'state', 'region');--> statement-breakpoint
CREATE TYPE "app"."rostering_entity_type" AS ENUM('org', 'class', 'course', 'user');--> statement-breakpoint
CREATE TYPE "app"."rostering_provider" AS ENUM('classlink', 'clever', 'nycps', 'csv');--> statement-breakpoint
CREATE TYPE "app"."school_level" AS ENUM('early_childhood', 'elementary', 'middle', 'high', 'postsecondary');--> statement-breakpoint
CREATE TYPE "app"."trial_interaction_type" AS ENUM('focus', 'blur', 'fullscreen_enter', 'fullscreen_exit');--> statement-breakpoint
CREATE TYPE "app"."user_family_role" AS ENUM('parent', 'child', 'guest');--> statement-breakpoint
CREATE TYPE "app"."user_role" AS ENUM('super_admin', 'platform_admin', 'launch_admin', 'admin', 'student');--> statement-breakpoint
CREATE TYPE "app"."user_type" AS ENUM('student', 'educator', 'caregiver', 'admin');--> statement-breakpoint
CREATE TYPE "app"."variant_status" AS ENUM('DRAFT', 'PUBLISHED', 'DEPRECATED');