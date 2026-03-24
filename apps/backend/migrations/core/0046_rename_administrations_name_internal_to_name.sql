ALTER TABLE "app"."administrations" RENAME COLUMN "name_internal" TO "name";--> statement-breakpoint
DROP INDEX "app"."administrations_name_internal_lower_idx";--> statement-breakpoint
DROP INDEX "app"."administrations_name_internal_lower_pattern_idx";--> statement-breakpoint
DROP INDEX "app"."administrations_name_internal_unique_idx";--> statement-breakpoint
CREATE INDEX "administrations_name_lower_idx" ON "app"."administrations" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "administrations_name_lower_pattern_idx" ON "app"."administrations" USING btree (lower("name") text_pattern_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "administrations_name_unique_idx" ON "app"."administrations" USING btree (lower("name"));