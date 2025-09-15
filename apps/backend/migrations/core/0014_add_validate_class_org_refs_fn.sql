-- Add validate_class_org_refs function
-- This function is used to validate that the schoolId and districtId columns in the classes table refer to valid orgs.
-- If both are provided, we ensure that the school is a child of the district (direct parent).

CREATE OR REPLACE FUNCTION app.validate_class_org_refs()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  v_school_type   TEXT;
  v_school_parent UUID;
  v_district_type TEXT;
BEGIN
  -- 1) validate school_id type
  IF NEW.school_id IS NOT NULL THEN
    SELECT org_type, parent_id
      INTO v_school_type, v_school_parent
    FROM app.orgs
    WHERE id = NEW.school_id;

    IF v_school_type IS DISTINCT FROM 'school' THEN
      RAISE EXCEPTION 'school_id % does not refer to an org with org_type=school', NEW.school_id
        USING ERRCODE = '23514', CONSTRAINT = 'classes_school_must_be_school';
    END IF;
  END IF;

  -- 2) validate district_id type
  IF NEW.district_id IS NOT NULL THEN
    SELECT org_type
      INTO v_district_type
    FROM app.orgs
    WHERE id = NEW.district_id;

    IF v_district_type IS DISTINCT FROM 'district' THEN
      RAISE EXCEPTION 'district_id % does not refer to an org with org_type=district', NEW.district_id
        USING ERRCODE = '23514', CONSTRAINT = 'classes_district_must_be_district';
    END IF;
  END IF;

  -- 3) school must be child of district (direct parent)
  IF NEW.school_id IS NOT NULL AND NEW.district_id IS NOT NULL THEN
    IF v_school_parent IS DISTINCT FROM NEW.district_id THEN
      RAISE EXCEPTION 'school % is not a child of district %', NEW.school_id, NEW.district_id
        USING ERRCODE = '23514', CONSTRAINT = 'classes_school_parent_must_match_district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Enable trigger on classes table
DROP TRIGGER IF EXISTS classes_validate_org_refs ON app.classes;
CREATE TRIGGER classes_validate_org_refs
  BEFORE INSERT OR UPDATE OF school_id, district_id
  ON app.classes
  FOR EACH ROW
  EXECUTE FUNCTION app.validate_class_org_refs();