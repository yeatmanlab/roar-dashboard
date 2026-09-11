-- Enable ltree extension for hierarchical path queries
CREATE EXTENSION IF NOT EXISTS ltree;--> statement-breakpoint

-- =============================================================================
-- Refactor groups: remove hierarchy (groups are now standalone)
-- =============================================================================
ALTER TABLE "app"."groups" DROP CONSTRAINT "groups_parent_group_id_groups_id_fk";--> statement-breakpoint
DROP INDEX "app"."groups_parent_idx";--> statement-breakpoint
ALTER TABLE "app"."groups" DROP COLUMN "parent_group_id";--> statement-breakpoint

-- =============================================================================
-- Add ltree path columns for hierarchical authorization
-- =============================================================================
ALTER TABLE "app"."orgs" ADD COLUMN "path" "ltree" NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."classes" ADD COLUMN "org_path" "ltree" NOT NULL;--> statement-breakpoint

-- =============================================================================
-- Create GiST indexes for ltree path queries
-- =============================================================================
CREATE INDEX "orgs_path_gist_idx" ON "app"."orgs" USING gist ("path");--> statement-breakpoint
CREATE INDEX "classes_org_path_gist_idx" ON "app"."classes" USING gist ("org_path");
