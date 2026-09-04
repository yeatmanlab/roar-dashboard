ALTER TABLE "app"."administrations" ADD COLUMN "excluded_from_research" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."administrations" ADD COLUMN "excluded_from_research_by" uuid;--> statement-breakpoint
ALTER TABLE "app"."administrations" ADD COLUMN "excluded_from_research_reason" text;--> statement-breakpoint
ALTER TABLE "app"."administrations" ADD CONSTRAINT "administrations_excluded_from_research_by_users_id_fk" FOREIGN KEY ("excluded_from_research_by") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users" DROP COLUMN "exclude_from_research";