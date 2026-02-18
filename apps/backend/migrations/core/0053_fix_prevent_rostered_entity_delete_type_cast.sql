-- =============================================================================
-- Fix prevent_rostered_entity_delete() type casting issue
-- =============================================================================
-- The original function compared entity_type (enum) with TG_ARGV[0] (text)
-- without proper casting, causing "operator does not exist" errors.
--
-- This migration adds explicit type casting to fix the comparison.
--
-- Note: 'group' is not in the rostering_entity_type enum, so we need to
-- handle it separately or skip the check for groups.
-- =============================================================================

CREATE OR REPLACE FUNCTION app.prevent_rostered_entity_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if the entity type is in the enum
  -- (groups are not rostered entities, so skip the check)
  IF TG_ARGV[0]::text = ANY(ARRAY['user', 'org', 'class', 'course']) THEN
    IF EXISTS (
      SELECT 1 FROM app.rostering_provider_ids
      WHERE entity_type = TG_ARGV[0]::app.rostering_entity_type AND entity_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'cannot delete rostered %: remove from rostering_provider_ids first', TG_ARGV[0]
        USING ERRCODE = '23503', CONSTRAINT = 'rostered_entity_protected';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;
