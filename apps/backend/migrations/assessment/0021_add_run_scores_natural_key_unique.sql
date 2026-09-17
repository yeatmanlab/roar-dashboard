-- Add a natural-key UNIQUE constraint on app.run_scores so we can use
-- INSERT ... ON CONFLICT (run_id, type, domain, name, assessment_stage) DO UPDATE
-- to upsert score rows from the writeTrial path.
--
-- The constraint also enforces the read-path invariant in report.repository.ts that
-- assumes at most one current score row per natural key — drift here would silently
-- corrupt reporting.
--
-- assessment_stage is nullable. Without NULLS NOT DISTINCT, two rows with identical
-- (run_id, type, domain, name) and a NULL assessment_stage would both be allowed
-- (Postgres treats NULL as distinct in unique constraints by default). NULLS NOT
-- DISTINCT (Postgres 15+) makes NULLs equal for uniqueness purposes.
--
-- Pre-flight: this migration will fail if duplicates already exist. Run
--   SELECT run_id, type, domain, name, assessment_stage, COUNT(*)
--   FROM app.run_scores
--   GROUP BY 1, 2, 3, 4, 5
--   HAVING COUNT(*) > 1;
-- against the target environment first and remediate before applying.

ALTER TABLE "app"."run_scores"
  ADD CONSTRAINT "run_scores_natural_key_unique"
  UNIQUE NULLS NOT DISTINCT ("run_id", "type", "domain", "name", "assessment_stage");
