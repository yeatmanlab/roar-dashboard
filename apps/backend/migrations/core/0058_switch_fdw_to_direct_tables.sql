-- Switch FDW foreign tables from assessment DB views to direct tables.
--
-- Previously, foreign tables pointed at app_fdw.fdw_runs and app_fdw.fdw_run_scores
-- views which filtered soft-deleted rows on the assessment DB side. Now they point
-- directly at app.runs and app.run_scores, with soft-delete filtering moving to the
-- core DB query layer.
--
-- Key improvement: the fdw_run_scores view always joined run_scores → runs to check
-- deleted_at, even for queries that only needed scores by run_id. Direct access
-- eliminates this unnecessary join (20-32% improvement in benchmarks).
--
-- New columns exposed: deleted_at, deleted_by, metadata, updated_at, created_at on
-- runs; updated_at, created_at on run_scores.
--
-- Prerequisites: assessment DB migration 0020_drop_fdw_views must have run first.

DROP FOREIGN TABLE IF EXISTS app_assessment_fdw.run_scores;
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
  metadata jsonb,
  is_anonymous boolean NOT NULL,
  completed_at timestamptz,
  aborted_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  updated_at timestamptz,
  created_at timestamptz NOT NULL
) SERVER assessment_server
  OPTIONS (schema_name 'app', table_name 'runs');

CREATE FOREIGN TABLE app_assessment_fdw.run_scores (
  id uuid NOT NULL,
  run_id uuid NOT NULL,
  type text NOT NULL,
  domain text NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  assessment_stage text,
  category_score boolean,
  updated_at timestamptz,
  created_at timestamptz NOT NULL
) SERVER assessment_server
  OPTIONS (schema_name 'app', table_name 'run_scores');
