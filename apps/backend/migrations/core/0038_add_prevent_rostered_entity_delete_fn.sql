-- =============================================================================
-- prevent_rostered_entity_delete()
-- =============================================================================
-- Trigger function that protects rostered entities from manual deletion.
-- Blocks DELETE on users, orgs, classes, courses, and groups if the entity
-- has a corresponding record in rostering_provider_ids.
--
-- To delete a rostered entity, the rostering sync must first remove the
-- rostering_provider_ids record, then delete the entity.
--
-- Error Codes:
--   23503 = foreign_key_violation (entity protected from delete)
--
-- See also: 0037_add_validate_rostering_entity_fk_fn.sql (insert/update validation)
-- =============================================================================

CREATE OR REPLACE FUNCTION app.prevent_rostered_entity_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM app.rostering_provider_ids
    WHERE entity_type = TG_ARGV[0] AND entity_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'cannot delete rostered %: remove from rostering_provider_ids first', TG_ARGV[0]
      USING ERRCODE = '23503', CONSTRAINT = 'rostered_entity_protected';
  END IF;
  RETURN OLD;
END;
$$;

-- =============================================================================
-- Apply delete protection triggers to each entity table
-- =============================================================================

DROP TRIGGER IF EXISTS prevent_rostered_user_delete ON app.users;
CREATE TRIGGER prevent_rostered_user_delete
  BEFORE DELETE ON app.users
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_rostered_entity_delete('user');

DROP TRIGGER IF EXISTS prevent_rostered_org_delete ON app.orgs;
CREATE TRIGGER prevent_rostered_org_delete
  BEFORE DELETE ON app.orgs
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_rostered_entity_delete('org');

DROP TRIGGER IF EXISTS prevent_rostered_class_delete ON app.classes;
CREATE TRIGGER prevent_rostered_class_delete
  BEFORE DELETE ON app.classes
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_rostered_entity_delete('class');

DROP TRIGGER IF EXISTS prevent_rostered_course_delete ON app.courses;
CREATE TRIGGER prevent_rostered_course_delete
  BEFORE DELETE ON app.courses
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_rostered_entity_delete('course');

DROP TRIGGER IF EXISTS prevent_rostered_group_delete ON app.groups;
CREATE TRIGGER prevent_rostered_group_delete
  BEFORE DELETE ON app.groups
  FOR EACH ROW
  EXECUTE FUNCTION app.prevent_rostered_entity_delete('group');
