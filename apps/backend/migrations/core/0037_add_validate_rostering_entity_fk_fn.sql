-- =============================================================================
-- validate_rostering_entity_fk()
-- =============================================================================
-- Trigger function that enforces referential integrity for the polymorphic FK
-- in rostering_provider_ids. Ensures entity_id exists in the table specified
-- by entity_type on INSERT/UPDATE.
--
-- Supported entity_type values: user, org, class, course, group
--
-- Error Codes:
--   23503 = foreign_key_violation (entity not found)
--   22000 = data_exception (unknown entity_type)
--
-- See also: 0038_add_prevent_rostered_entity_delete_fn.sql (delete protection)
-- =============================================================================

CREATE OR REPLACE FUNCTION app.validate_rostering_entity_fk()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  CASE NEW.entity_type
    WHEN 'user' THEN
      IF NOT EXISTS (
        SELECT 1 FROM app.users u WHERE u.id = NEW.entity_id
      ) THEN
        RAISE EXCEPTION 'entity_id % not found in users', NEW.entity_id
          USING ERRCODE = '23503', CONSTRAINT = 'user_entity_id_not_found';
      END IF;

    WHEN 'org' THEN
      IF NOT EXISTS (
        SELECT 1 FROM app.orgs o WHERE o.id = NEW.entity_id
      ) THEN
        RAISE EXCEPTION 'entity_id % not found in orgs', NEW.entity_id
          USING ERRCODE = '23503', CONSTRAINT = 'org_entity_id_not_found';
      END IF;

    WHEN 'class' THEN
      IF NOT EXISTS (
        SELECT 1 FROM app.classes c WHERE c.id = NEW.entity_id
      ) THEN
        RAISE EXCEPTION 'entity_id % not found in classes', NEW.entity_id
          USING ERRCODE = '23503', CONSTRAINT = 'class_entity_id_not_found';
      END IF;

    WHEN 'course' THEN
      IF NOT EXISTS (
        SELECT 1 FROM app.courses c WHERE c.id = NEW.entity_id
      ) THEN
        RAISE EXCEPTION 'entity_id % not found in courses', NEW.entity_id
          USING ERRCODE = '23503', CONSTRAINT = 'course_entity_id_not_found';
      END IF;

    WHEN 'group' THEN
      IF NOT EXISTS (
        SELECT 1 FROM app.groups g WHERE g.id = NEW.entity_id
      ) THEN
        RAISE EXCEPTION 'entity_id % not found in groups', NEW.entity_id
          USING ERRCODE = '23503', CONSTRAINT = 'group_entity_id_not_found';
      END IF;

    ELSE
      RAISE EXCEPTION 'unknown entity_type: %', NEW.entity_type
        USING ERRCODE = '22000', CONSTRAINT = 'invalid_entity_type';
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_rostering_provider_entity_fk
  ON app.rostering_provider_ids;

CREATE TRIGGER validate_rostering_provider_entity_fk
  BEFORE INSERT OR UPDATE OF entity_type, entity_id
  ON app.rostering_provider_ids
  FOR EACH ROW
  EXECUTE FUNCTION app.validate_rostering_entity_fk();