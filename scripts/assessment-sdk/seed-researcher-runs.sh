#!/bin/bash
# Seed sample assessment runs for researcher testing
# Usage: npm run seed:researcher:runs

set -e

CORE_DB="postgresql://postgres:postgres@localhost:5433/roar_core"
ASSESS_DB="postgresql://postgres:postgres@localhost:5433/roar_assessment"

echo "🌱 Seeding sample assessment runs..."

# Get IDs from roar_core
STUDENT_ID=$(psql "$CORE_DB" -t -c "SELECT id FROM app.users WHERE name_first = 'Researcher' AND name_last = 'Student' LIMIT 1;" | xargs)
TASK_ID=$(psql "$CORE_DB" -t -c "SELECT id FROM app.tasks WHERE slug = 'researcher-task' LIMIT 1;" | xargs)
TASK_VARIANT_ID=$(psql "$CORE_DB" -t -c "SELECT id FROM app.task_variants WHERE name = 'Researcher Task Variant' LIMIT 1;" | xargs)
ADMIN_ID=$(psql "$CORE_DB" -t -c "SELECT id FROM app.administrations WHERE name = 'Researcher Administration' LIMIT 1;" | xargs)

if [ -z "$STUDENT_ID" ] || [ -z "$TASK_ID" ] || [ -z "$TASK_VARIANT_ID" ] || [ -z "$ADMIN_ID" ]; then
  echo "❌ Error: Could not find required IDs in roar_core database"
  echo "   Make sure you've run: npm run seed:researcher"
  exit 1
fi

# Create runs in roar_assessment
psql "$ASSESS_DB" <<EOF
BEGIN;

WITH ids AS (
  SELECT
    '$STUDENT_ID'::uuid as student_id,
    '$TASK_ID'::uuid as task_id,
    '$TASK_VARIANT_ID'::uuid as task_variant_id,
    '$ADMIN_ID'::uuid as admin_id
)
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
FROM ids, generate_series(1, 3);

COMMIT;
EOF

echo "✅ Sample assessment runs created successfully!"
echo "   View them in pgweb: http://localhost:8081 → roar_assessment → runs"
