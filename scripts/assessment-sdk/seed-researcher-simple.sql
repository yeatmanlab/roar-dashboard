-- ════════════════════════════════════════════════════════════════════════════
-- Simple Researcher Data Seeding Script
-- ════════════════════════════════════════════════════════════════════════════
-- Run this script to seed minimal test data for the researcher environment.
-- Usage: psql postgresql://postgres:postgres@localhost:5433/roar_core < scripts/seed-researcher-simple.sql

BEGIN;

-- Create district (root org)
INSERT INTO app.orgs (abbreviation, name, org_type, parent_org_id, path, is_rostering_root_org)
VALUES ('RD', 'Researcher District', 'district', NULL, 'district_researcher', TRUE);

-- Create school
INSERT INTO app.orgs (abbreviation, name, org_type, parent_org_id, path, is_rostering_root_org)
SELECT 'RS', 'Researcher School', 'school', id, 'district_researcher.school_researcher', FALSE
FROM app.orgs WHERE name = 'Researcher District';

-- Create class
INSERT INTO app.classes (name, school_id, district_id, org_path, class_type)
SELECT 'Researcher Class', 
       (SELECT id FROM app.orgs WHERE name = 'Researcher School' LIMIT 1), 
       (SELECT id FROM app.orgs WHERE name = 'Researcher District' LIMIT 1), 
       'district_researcher.school_researcher', 
       'homeroom'
ON CONFLICT DO NOTHING;

-- Create teacher
INSERT INTO app.users (name_first, name_last, user_type, grade)
VALUES ('Researcher', 'Teacher', 'educator', NULL);

-- Create student
INSERT INTO app.users (name_first, name_last, user_type, grade)
VALUES ('Researcher', 'Student', 'student', '5');

-- Assign teacher to school
INSERT INTO app.user_orgs (user_id, org_id, role, enrollment_start)
SELECT u.id, o.id, 'teacher', NOW()
FROM app.users u, app.orgs o
WHERE u.name_first = 'Researcher' AND u.name_last = 'Teacher'
  AND o.name = 'Researcher School'
ON CONFLICT DO NOTHING;

-- Assign student to class
INSERT INTO app.user_classes (user_id, class_id, role, enrollment_start)
SELECT u.id, c.id, 'student', NOW()
FROM app.users u, app.classes c
WHERE u.name_first = 'Researcher' AND u.name_last = 'Student'
  AND c.name = 'Researcher Class'
ON CONFLICT DO NOTHING;

-- Create task (if not exists)
INSERT INTO app.tasks (slug, name, name_simple, name_technical, description, image, tutorial_video, task_config)
VALUES ('researcher-task', 'Researcher Task', 'Researcher Task', 'Researcher Task (Technical)', 'A simple task for researchers to test the assessment platform', NULL, NULL, '{}')
ON CONFLICT (slug) DO NOTHING;

-- Create task variant (if not exists)
INSERT INTO app.task_variants (task_id, name, description, status)
SELECT id, 'Researcher Task Variant', 'The default variant for the researcher task', 'published'
FROM app.tasks WHERE slug = 'researcher-task'
ON CONFLICT DO NOTHING;

-- Create administration (if not exists)
INSERT INTO app.administrations (name, name_public, description, date_start, date_end, is_ordered, created_by)
SELECT 'Researcher Administration', 'Researcher Administration', 'An administration for researchers to test assessment flows', NOW() + INTERVAL '1 day', NOW() + INTERVAL '7 days', FALSE, u.id
FROM app.users u
WHERE u.name_first = 'Researcher' AND u.name_last = 'Teacher'
ON CONFLICT (lower(name)) DO NOTHING;

-- Assign administration to district
INSERT INTO app.administration_orgs (administration_id, org_id)
SELECT a.id, o.id
FROM app.administrations a, app.orgs o
WHERE a.name = 'Researcher Administration' AND o.name = 'Researcher District'
ON CONFLICT DO NOTHING;

-- Assign task variant to administration (if not exists)
INSERT INTO app.administration_task_variants (administration_id, task_variant_id, order_index)
SELECT a.id, tv.id, 0
FROM app.administrations a, app.task_variants tv
WHERE a.name = 'Researcher Administration' AND tv.name = 'Researcher Task Variant'
ON CONFLICT DO NOTHING;

SELECT 'Researcher data seeded successfully!' AS message;

COMMIT;
