-- Drop the FDW views and schema from the assessment database.
--
-- The core database is switching from FDW foreign tables that point at these views
-- to foreign tables that point directly at app.runs and app.run_scores.
-- Soft-delete filtering will move to the core DB query layer.
--
-- The app_fdw.fdw_run_scores view was joining run_scores → runs on every query
-- to inherit soft-delete filtering, even when the caller only needed scores by run_id.
-- Benchmarks showed 20-32% improvement on score queries by eliminating this join.
--
-- Prerequisites: the core DB migration that recreates the foreign tables must run
-- AFTER this migration, since the existing foreign tables still reference these views.

DROP VIEW IF EXISTS app_fdw.fdw_run_scores;
DROP VIEW IF EXISTS app_fdw.fdw_runs;
DROP SCHEMA IF EXISTS app_fdw;
