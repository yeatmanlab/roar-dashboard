-- Add created_at to both FDW views so the core database can access run timestamps.

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
  aborted_at,
  created_at
FROM app.runs
WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW app_fdw.fdw_run_scores AS
SELECT
  rs.id, rs.run_id, rs.type, rs.domain,
  rs.name, rs.value, rs.assessment_stage, rs.category_score,
  rs.created_at
FROM app.run_scores rs
INNER JOIN app.runs r ON rs.run_id = r.id
WHERE r.deleted_at IS NULL;
