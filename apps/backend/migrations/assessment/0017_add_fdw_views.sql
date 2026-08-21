-- Create filtered FDW views in the app_fdw schema.
--
-- Pre-requisites (handled by bootstrap scripts in roar-iac, or setup-fdw-local.sh locally):
--   - role_fdw_reader must exist (GRANTs handled by bootstrap scripts)
--
-- These views expose a subset of columns from app.* base tables for cross-database
-- access via postgres_fdw. role_fdw_reader has USAGE on app_fdw only, not on app.
--
-- Views run with the view owner's privileges (role_app_migrator), which has access to app.
-- Soft-deleted runs are excluded from both views.
--
-- Excluded columns from runs:
--   metadata   — internal assessment engine data, not needed by core DB queries
--   deleted_at — filtered by WHERE clause
--   deleted_by — internal audit field
--   created_at — audit timestamp not needed for cross-DB joins
--   updated_at — audit timestamp not needed for cross-DB joins
--
-- Excluded columns from run_scores:
--   created_at — audit timestamp not needed for cross-DB joins
--   updated_at — audit timestamp not needed for cross-DB joins

CREATE SCHEMA IF NOT EXISTS app_fdw;

CREATE OR REPLACE VIEW app_fdw.fdw_runs AS
SELECT
  id,
  user_id,
  task_id,
  task_variant_id,
  task_version,
  administration_id,
  use_for_reporting,
  reliable_run,
  engagement_flags,
  is_anonymous,
  completed_at,
  aborted_at
FROM app.runs
WHERE deleted_at IS NULL;

-- run_scores has no deleted_at column; soft-delete cascades via the runs JOIN
CREATE OR REPLACE VIEW app_fdw.fdw_run_scores AS
SELECT
  rs.id, rs.run_id, rs.type, rs.domain,
  rs.name, rs.value, rs.assessment_stage, rs.category_score
FROM app.run_scores rs
INNER JOIN app.runs r ON rs.run_id = r.id
WHERE r.deleted_at IS NULL;
