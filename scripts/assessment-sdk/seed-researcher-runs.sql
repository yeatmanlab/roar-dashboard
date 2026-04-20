-- ════════════════════════════════════════════════════════════════════════════
-- Seed Sample Assessment Runs for Researcher Testing
-- ════════════════════════════════════════════════════════════════════════════
-- This script creates sample assessment runs in roar_assessment database
-- Usage: psql postgresql://postgres:postgres@localhost:5433/roar_core -c "
--   WITH ids AS (
--     SELECT id FROM app.users WHERE name_first = 'Researcher' AND name_last = 'Student' LIMIT 1
--   )
--   SELECT * FROM ids;
-- " && psql postgresql://postgres:postgres@localhost:5433/roar_assessment < scripts/seed-researcher-runs.sql

BEGIN;

-- Get IDs from roar_core (you'll need to provide these)
-- Run this first to get the IDs:
-- psql postgresql://postgres:postgres@localhost:5433/roar_core -c "
--   SELECT 
--     (SELECT id FROM app.users WHERE name_first = 'Researcher' AND name_last = 'Student' LIMIT 1) as student_id,
--     (SELECT id FROM app.tasks WHERE slug = 'researcher-task' LIMIT 1) as task_id,
--     (SELECT id FROM app.task_variants WHERE name = 'Researcher Task Variant' LIMIT 1) as task_variant_id,
--     (SELECT id FROM app.administrations WHERE name = 'Researcher Administration' LIMIT 1) as admin_id;
-- "

-- For now, using hardcoded IDs - replace with actual IDs from above query
WITH ids AS (
  SELECT
    '37ad7211-3e33-48c8-b851-a67c692c03c2'::uuid as student_id,
    'e9ed1001-1511-4a27-9d79-a1a87787afa2'::uuid as task_id,
    '4f5bb070-4a73-4a51-937f-7d2b777acdff'::uuid as task_variant_id,
    'b659783b-ab81-454b-8e68-87eeb21f8651'::uuid as admin_id
)
-- Create 3 sample runs
INSERT INTO app.runs (
  id,
  user_id,
  task_id,
  task_variant_id,
  task_version,
  administration_id,
  use_for_reporting,
  reliable_run,
  is_anonymous,
  completed_at
)
SELECT
  gen_random_uuid(),
  ids.student_id,
  ids.task_id,
  ids.task_variant_id,
  '1.0',
  ids.admin_id,
  true,
  true,
  false,
  NOW() - (INTERVAL '1 day' * (row_number() OVER (ORDER BY 1)))
FROM ids, generate_series(1, 3)
WHERE ids.student_id IS NOT NULL
  AND ids.task_id IS NOT NULL
  AND ids.task_variant_id IS NOT NULL
  AND ids.admin_id IS NOT NULL;

SELECT 'Sample assessment runs created!' AS message;

COMMIT;
