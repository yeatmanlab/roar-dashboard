-- Add validate_org_hierarchy function
-- This function is designed to enforce org hierarchy with explicit root rule:
-- - Roots: parent_org_id IS NULL AND is_rostering_root_org = TRUE AND org_type <> 'department'
-- - Canonical chain (non-roots): national → state → local → district → school
-- - Department may appear between/under anything except:
--   - cannot be a root
--   - cannot have parent national
--   - allowed parents: state, local, district, school

CREATE OR REPLACE FUNCTION app.validate_org_hierarchy()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type TEXT;
  v_is_root     BOOLEAN;
BEGIN
  v_is_root := (NEW.parent_org_id IS NULL);

  -- Basic sanity
  IF NEW.id IS NOT NULL AND NEW.parent_org_id = NEW.id THEN
    RAISE EXCEPTION 'an organization cannot be its own parent'
      USING ERRCODE = '23514', CONSTRAINT = 'org_no_self_parent';
  END IF;

  -- Root handling
  IF v_is_root THEN
    IF NOT NEW.is_rostering_root_org THEN
      RAISE EXCEPTION 'root rows must have is_rostering_root_org = TRUE'
        USING ERRCODE = '23514', CONSTRAINT = 'org_root_requires_flag';
    END IF;
    IF NEW.org_type = 'department' THEN
      RAISE EXCEPTION 'department cannot be a root organization'
        USING ERRCODE = '23514', CONSTRAINT = 'org_department_not_root';
    END IF;
    RETURN NEW;
  ELSE
    IF NEW.is_rostering_root_org THEN
      RAISE EXCEPTION 'is_rostering_root_org must be FALSE when parent_org_id is set'
        USING ERRCODE = '23514', CONSTRAINT = 'org_root_flag_mismatch';
    END IF;
  END IF;

  -- Parent must exist for non-roots
  SELECT org_type INTO v_parent_type
  FROM app.orgs
  WHERE id = NEW.parent_org_id;

  IF v_parent_type IS NULL THEN
    RAISE EXCEPTION 'parent org % not found', NEW.parent_org_id
      USING ERRCODE = '23503', CONSTRAINT = 'org_parent_missing';
  END IF;

  -- Allowed parent by child type
  CASE NEW.org_type
    WHEN 'national' THEN
      RAISE EXCEPTION 'org_type = national must be a root (no parent)'
        USING ERRCODE = '23514', CONSTRAINT = 'org_national_must_be_root';

    WHEN 'state' THEN
      IF v_parent_type <> 'national' THEN
        RAISE EXCEPTION 'state must have parent national (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_state_parent_is_national';
      END IF;

    WHEN 'local' THEN
      IF v_parent_type NOT IN ('state','department') THEN
        RAISE EXCEPTION 'local must have parent state or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_local_parent_allowed';
      END IF;

    WHEN 'district' THEN
      IF v_parent_type NOT IN ('local','department') THEN
        RAISE EXCEPTION 'district must have parent local or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_district_parent_allowed';
      END IF;

    WHEN 'school' THEN
      IF v_parent_type NOT IN ('district','department') THEN
        RAISE EXCEPTION 'school must have parent district or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_school_parent_allowed';
      END IF;

    WHEN 'department' THEN
      -- cannot be root; cannot have parent national; cannot have parent department
      IF v_parent_type NOT IN ('state','local','district','school') THEN
        RAISE EXCEPTION 'department cannot have parent % (allowed: state, local, district, school)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_department_parent_allowed';
      END IF;

    ELSE
      RAISE EXCEPTION 'unknown org_type %', NEW.org_type
        USING ERRCODE = '22000', CONSTRAINT = 'org_type_unknown';
  END CASE;

  -- optional cycle detection
  IF NEW.id IS NOT NULL THEN
    IF EXISTS (
      WITH RECURSIVE up(id, parent_id) AS (
        SELECT p.id, p.parent_org_id
        FROM app.orgs p
        WHERE p.id = NEW.parent_org_id
        UNION ALL
        SELECT o.id, o.parent_org_id
        FROM app.orgs o
        JOIN up ON o.id = up.parent_id
      )
      SELECT 1 FROM up WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'hierarchy cycle detected involving org %', NEW.id
        USING ERRCODE = '23514', CONSTRAINT = 'org_hierarchy_cycle';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Add trigger to validate org hierarchy
DROP TRIGGER IF EXISTS orgs_validate_hierarchy ON app.orgs;
CREATE TRIGGER orgs_validate_hierarchy
  BEFORE INSERT OR UPDATE OF org_type, parent_org_id, is_rostering_root_org
  ON app.orgs
  FOR EACH ROW
  EXECUTE FUNCTION app.validate_org_hierarchy();