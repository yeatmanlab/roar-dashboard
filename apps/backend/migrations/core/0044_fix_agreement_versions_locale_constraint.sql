ALTER TABLE "app"."agreement_versions" DROP CONSTRAINT "agreement_versions_locale_format";--> statement-breakpoint
ALTER TABLE "app"."agreement_versions" ALTER COLUMN "locale" SET DATA TYPE varchar(10);--> statement-breakpoint
ALTER TABLE "app"."agreement_versions" ADD CONSTRAINT "agreement_versions_locale_format" CHECK ("app"."agreement_versions"."locale" ~ '^[a-z]{2}(-[A-Z]{2})?$');