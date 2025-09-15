DROP INDEX "app"."orgs_name_lower_idx";--> statement-breakpoint
DROP INDEX "app"."groups_name_lower_idx";--> statement-breakpoint
DROP INDEX "app"."courses_name_lower_idx";--> statement-breakpoint
CREATE INDEX "orgs_name_lower_idx" ON "app"."orgs" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "groups_name_lower_idx" ON "app"."groups" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "courses_name_lower_idx" ON "app"."courses" USING btree (lower("name"));