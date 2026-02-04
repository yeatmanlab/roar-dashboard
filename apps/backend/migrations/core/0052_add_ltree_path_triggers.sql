-- Path Maintenance Triggers for ltree columns

-- Helper function: Convert org to ltree label
-- Format: {org_type}_{uuid_with_underscores} (e.g., "district_550e8400_e29b_41d4_a716_446655440000")
-- IMMUTABLE + PARALLEL SAFE flags enable PostgreSQL query optimization (caching, parallel execution)
CREATE OR REPLACE FUNCTION app.org_to_ltree_label(org_type app.org_type, id uuid)
RETURNS ltree
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (org_type::text || '_' || replace(id::text, '-', '_'))::ltree;
$$;

-- -----------------------------------------------------------------------------
-- ORGS: Path Triggers
-- -----------------------------------------------------------------------------

-- Compute org path on insert
CREATE OR REPLACE FUNCTION app.compute_org_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_path ltree;
BEGIN
  IF NEW.parent_org_id IS NULL THEN
    NEW.path := app.org_to_ltree_label(NEW.org_type, NEW.id);
  ELSE
    SELECT path INTO STRICT parent_path
    FROM app.orgs
    WHERE id = NEW.parent_org_id;

    NEW.path := parent_path || app.org_to_ltree_label(NEW.org_type, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orgs_compute_path_insert
BEFORE INSERT ON app.orgs
FOR EACH ROW
EXECUTE FUNCTION app.compute_org_path();

-- Update org paths when reparenting
CREATE OR REPLACE FUNCTION app.update_org_descendant_paths()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_path ltree;
  new_path ltree;
  new_parent_path ltree;
BEGIN
  -- Only act if parent_org_id actually changed (defensive, trigger is narrowed)
  IF OLD.parent_org_id IS NOT DISTINCT FROM NEW.parent_org_id THEN
    RETURN NEW;
  END IF;

  -- Fail fast: org cannot be its own parent
  IF NEW.parent_org_id = NEW.id THEN
    RAISE EXCEPTION 'Invalid move: org % cannot be its own parent', NEW.id;
  END IF;

  old_path := OLD.path;

  -- Compute new path for this org
  IF NEW.parent_org_id IS NULL THEN
    -- Moving to root level
    new_path := app.org_to_ltree_label(NEW.org_type, NEW.id);
  ELSE
    -- Moving under a parent - get parent's path (STRICT raises if parent doesn't exist)
    SELECT path INTO STRICT new_parent_path
    FROM app.orgs
    WHERE id = NEW.parent_org_id;

    -- Prevent cycles: new parent cannot be inside this org's subtree
    IF new_parent_path <@ old_path THEN
      RAISE EXCEPTION 'Invalid move: cannot reparent org % under its descendant %',
        NEW.id, NEW.parent_org_id;
    END IF;

    new_path := new_parent_path || app.org_to_ltree_label(NEW.org_type, NEW.id);
  END IF;

  NEW.path := new_path;

  -- Update all descendants: replace old_path prefix with new_path
  UPDATE app.orgs
  SET path = new_path || subpath(path, nlevel(old_path))
  WHERE path <@ old_path AND id != NEW.id;

  -- Update classes under this org and its descendants
  UPDATE app.classes
  SET org_path = new_path || subpath(org_path, nlevel(old_path))
  WHERE org_path <@ old_path;

  RETURN NEW;
END;
$$;

-- Narrow trigger to only fire on parent_org_id changes
CREATE TRIGGER trg_orgs_update_descendant_paths
BEFORE UPDATE OF parent_org_id ON app.orgs
FOR EACH ROW
WHEN (OLD.parent_org_id IS DISTINCT FROM NEW.parent_org_id)
EXECUTE FUNCTION app.update_org_descendant_paths();

-- -----------------------------------------------------------------------------
-- CLASSES: Path Triggers
-- -----------------------------------------------------------------------------

-- Copies the org path from the class's school to maintain the org_path column
-- for hierarchical authorization queries (e.g., finding all classes under a district)
CREATE OR REPLACE FUNCTION app.compute_class_org_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT path INTO STRICT NEW.org_path
  FROM app.orgs
  WHERE id = NEW.school_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_classes_compute_org_path_insert
BEFORE INSERT ON app.classes
FOR EACH ROW
EXECUTE FUNCTION app.compute_class_org_path();

-- Update class org_path when school changes
CREATE OR REPLACE FUNCTION app.update_class_org_path()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT path INTO STRICT NEW.org_path
  FROM app.orgs
  WHERE id = NEW.school_id;

  RETURN NEW;
END;
$$;

-- Narrow trigger to only fire on school_id changes
CREATE TRIGGER trg_classes_update_org_path
BEFORE UPDATE OF school_id ON app.classes
FOR EACH ROW
WHEN (OLD.school_id IS DISTINCT FROM NEW.school_id)
EXECUTE FUNCTION app.update_class_org_path();
