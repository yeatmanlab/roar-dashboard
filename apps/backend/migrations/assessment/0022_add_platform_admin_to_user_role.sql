-- Add `platform_admin` to the assessment-side `user_role` enum.
--
-- The shared Drizzle enum definition in `apps/backend/src/db/schema/enums.ts` already
-- includes `platform_admin`, and the core DB has the equivalent migration
-- (core/0062_young_tomas.sql), but the assessment-side migration was never generated.
-- This brings the two enum copies back in sync.
--
-- Surfaced incidentally by `db:gen:assess` while validating the run_scores natural-key
-- unique constraint migration (0021).

ALTER TYPE "app"."user_role" ADD VALUE 'platform_admin' BEFORE 'principal';