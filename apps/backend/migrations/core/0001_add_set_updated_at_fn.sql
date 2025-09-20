-- Add set_updated_at function
-- This function is used to automatically update the updated_at column on row update.

CREATE OR REPLACE FUNCTION app.set_updated_at()
  RETURNS trigger AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
