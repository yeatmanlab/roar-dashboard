-- Recreate FDW foreign tables with created_at column.
-- Foreign tables don't support ALTER ... ADD COLUMN, so we drop and recreate.

DROP FOREIGN TABLE IF EXISTS app_assessment_fdw.runs;

CREATE FOREIGN TABLE app_assessment_fdw.runs (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  task_variant_id uuid NOT NULL,
  task_version text NOT NULL,
  administration_id uuid NOT NULL,
  use_for_reporting boolean NOT NULL,
  reliable_run boolean NOT NULL,
  engagement_flags jsonb,
  is_anonymous boolean,
  completed_at timestamptz,
  aborted_at timestamptz,
  created_at timestamptz NOT NULL
) SERVER assessment_server
  OPTIONS (schema_name 'app_fdw', table_name 'fdw_runs');

DROP FOREIGN TABLE IF EXISTS app_assessment_fdw.run_scores;

CREATE FOREIGN TABLE app_assessment_fdw.run_scores (
  id uuid NOT NULL,
  run_id uuid NOT NULL,
  type text NOT NULL,
  domain text NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  assessment_stage text,
  category_score boolean,
  created_at timestamptz NOT NULL
) SERVER assessment_server
  OPTIONS (schema_name 'app_fdw', table_name 'fdw_run_scores');
