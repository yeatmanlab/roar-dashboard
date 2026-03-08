-- Custom SQL migration file, put your code below! --
-- Create the app_assessment_fdw schema, foreign tables, and grants.
-- Foreign tables reference the assessment_server created by the bootstrap (ticket #03).
-- Enums are mapped as text since PostgreSQL enums are database-local.

CREATE SCHEMA IF NOT EXISTS app_assessment_fdw;

CREATE FOREIGN TABLE IF NOT EXISTS app_assessment_fdw.runs (
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
  aborted_at timestamptz
) SERVER assessment_server
  OPTIONS (schema_name 'app_fdw', table_name 'fdw_runs');

CREATE FOREIGN TABLE IF NOT EXISTS app_assessment_fdw.run_scores (
  id uuid NOT NULL,
  run_id uuid NOT NULL,
  type text NOT NULL,
  domain text NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  assessment_stage text,
  category_score boolean
) SERVER assessment_server
  OPTIONS (schema_name 'app_fdw', table_name 'fdw_run_scores');
