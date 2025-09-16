-- Add user_families_student_active_uniqIdx
-- Due to https://github.com/drizzle-team/drizzle-orm/issues/3349, the unique index cannot currently be declared inside
-- the users-families schema declaration and must be added here as a raw SQL migration.

CREATE UNIQUE INDEX IF NOT EXISTS user_families_student_active_uniqIdx
  ON app.user_families (user_id)
  WHERE role = 'student'::app.user_role AND left_on IS NULL;