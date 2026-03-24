-- Add created_at column to FDW foreign tables using ALTER FOREIGN TABLE.

ALTER FOREIGN TABLE app_assessment_fdw.runs ADD COLUMN created_at timestamptz NOT NULL;
ALTER FOREIGN TABLE app_assessment_fdw.run_scores ADD COLUMN created_at timestamptz NOT NULL;
