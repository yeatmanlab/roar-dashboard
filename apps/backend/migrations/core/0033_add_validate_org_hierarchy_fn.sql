-- =============================================================================
-- validate_org_hierarchy()
-- =============================================================================
-- Trigger function that enforces organizational hierarchy rules on INSERT/UPDATE.
--
-- Hierarchy Ranking (highest to lowest):
--   national > state > local > district > school
--
-- Rules:
--   1. Any org type can be a root (parent_org_id IS NULL)
--   2. Root orgs must have is_rostering_root_org = TRUE
--   3. Non-root orgs must have is_rostering_root_org = FALSE
--   4. National orgs must always be roots (nothing can be above them)
--   5. Non-root orgs must have a parent of higher rank
--   6. Department is special: can attach to state/local/district/school,
--      and can be parent of local/district/school (acts as intermediary)
--   7. An org cannot be its own parent
--   8. Circular hierarchies are not allowed
--
-- Error Codes:
--   23514 = check_violation (hierarchy/logic errors)
--   23503 = foreign_key_violation (parent not found)
--   22000 = data_exception (unknown org_type)
-- =============================================================================

CREATE OR REPLACE FUNCTION app.validate_org_hierarchy()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_type TEXT;
  v_is_root     BOOLEAN;
BEGIN
  v_is_root := (NEW.parent_org_id IS NULL);

  -- ---------------------------------------------------------------------------
  -- Self-reference check: an org cannot be its own parent
  -- ---------------------------------------------------------------------------
  IF NEW.id IS NOT NULL AND NEW.parent_org_id = NEW.id THEN
    RAISE EXCEPTION 'an organization cannot be its own parent'
      USING ERRCODE = '23514', CONSTRAINT = 'org_no_self_parent';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Root org handling
  -- ---------------------------------------------------------------------------
  -- Roots: parent_org_id IS NULL, is_rostering_root_org must be TRUE
  -- Non-roots: parent_org_id IS NOT NULL, is_rostering_root_org must be FALSE
  -- ---------------------------------------------------------------------------
  IF v_is_root THEN
    IF NOT NEW.is_rostering_root_org THEN
      RAISE EXCEPTION 'root rows must have is_rostering_root_org = TRUE'
        USING ERRCODE = '23514', CONSTRAINT = 'org_root_requires_flag';
    END IF;
    -- Roots have no parent to validate, so we're done
    RETURN NEW;
  ELSE
    IF NEW.is_rostering_root_org THEN
      RAISE EXCEPTION 'is_rostering_root_org must be FALSE when parent_org_id is set'
        USING ERRCODE = '23514', CONSTRAINT = 'org_root_flag_mismatch';
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Parent existence check (for non-roots only)
  -- ---------------------------------------------------------------------------
  SELECT org_type INTO v_parent_type
  FROM app.orgs
  WHERE id = NEW.parent_org_id;

  IF v_parent_type IS NULL THEN
    RAISE EXCEPTION 'parent org % not found', NEW.parent_org_id
      USING ERRCODE = '23503', CONSTRAINT = 'org_parent_missing';
  END IF;

  -- ---------------------------------------------------------------------------
  -- Hierarchy validation: ensure parent is of valid type for this org_type
  -- ---------------------------------------------------------------------------
  -- Levels can be skipped (e.g., school under state), but inversions are
  -- not allowed (e.g., district under school).
  -- ---------------------------------------------------------------------------
  CASE NEW.org_type
    WHEN 'national' THEN
      -- national is the highest rank; if it has a parent, that's an error
      RAISE EXCEPTION 'org_type = national must be a root (no parent)'
        USING ERRCODE = '23514', CONSTRAINT = 'org_national_must_be_root';

    WHEN 'state' THEN
      -- state can only have national as parent
      IF v_parent_type NOT IN ('national') THEN
        RAISE EXCEPTION 'state must have parent national (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_state_parent_allowed';
      END IF;

    WHEN 'local' THEN
      -- local can have national, state, or department as parent
      IF v_parent_type NOT IN ('national', 'state', 'department') THEN
        RAISE EXCEPTION 'local must have parent national, state, or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_local_parent_allowed';
      END IF;

    WHEN 'district' THEN
      -- district can have national, state, local, or department as parent
      IF v_parent_type NOT IN ('national', 'state', 'local', 'department') THEN
        RAISE EXCEPTION 'district must have parent national, state, local, or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_district_parent_allowed';
      END IF;

    WHEN 'school' THEN
      -- school can have any higher-ranked type or department as parent
      IF v_parent_type NOT IN ('national', 'state', 'local', 'district', 'department') THEN
        RAISE EXCEPTION 'school must have parent national, state, local, district, or department (got %)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_school_parent_allowed';
      END IF;

    WHEN 'department' THEN
      -- department can have state, local, district, or school as parent
      -- (cannot have national or another department)
      IF v_parent_type NOT IN ('state', 'local', 'district', 'school') THEN
        RAISE EXCEPTION 'department cannot have parent % (allowed: state, local, district, school)', v_parent_type
          USING ERRCODE = '23514', CONSTRAINT = 'org_department_parent_allowed';
      END IF;

    ELSE
      RAISE EXCEPTION 'unknown org_type %', NEW.org_type
        USING ERRCODE = '22000', CONSTRAINT = 'org_type_unknown';
  END CASE;

  -- ---------------------------------------------------------------------------
  -- Cycle detection: prevent circular hierarchies
  -- ---------------------------------------------------------------------------
  -- Uses a recursive CTE to walk up the parent chain from the proposed parent.
  -- If we encounter NEW.id in the chain, we have a cycle.
  -- Only runs on UPDATE (NEW.id is NULL on INSERT).
  -- ---------------------------------------------------------------------------
  IF NEW.id IS NOT NULL THEN
    IF EXISTS (
      WITH RECURSIVE ancestors(id, parent_id, depth) AS (
        -- Start from the proposed parent
        SELECT p.id, p.parent_org_id, 1
        FROM app.orgs p
        WHERE p.id = NEW.parent_org_id
        UNION ALL
        -- Walk up the tree (with depth limit to prevent infinite loops)
        SELECT o.id, o.parent_org_id, ancestors.depth + 1
        FROM app.orgs o
        JOIN ancestors ON o.id = ancestors.parent_id
        WHERE ancestors.depth < 100
      )
      SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'hierarchy cycle detected involving org %', NEW.id
        USING ERRCODE = '23514', CONSTRAINT = 'org_hierarchy_cycle';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- Trigger: orgs_validate_hierarchy
-- =============================================================================
-- Fires BEFORE INSERT or UPDATE on columns that affect hierarchy.
-- Validates the org hierarchy rules before allowing the change.
-- =============================================================================
DROP TRIGGER IF EXISTS orgs_validate_hierarchy ON app.orgs;
CREATE TRIGGER orgs_validate_hierarchy
  BEFORE INSERT OR UPDATE OF org_type, parent_org_id, is_rostering_root_org
  ON app.orgs
  FOR EACH ROW
  EXECUTE FUNCTION app.validate_org_hierarchy();
