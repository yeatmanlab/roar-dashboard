CREATE TABLE app.user_research_exclusions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  exclude_from     TIMESTAMPTZ NOT NULL,
  exclude_until    TIMESTAMPTZ NOT NULL,
  excluded_by      UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
  exclusion_reason TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ,

  CONSTRAINT user_research_exclusions_date_range_check CHECK (exclude_from < exclude_until)
);

CREATE INDEX user_research_exclusions_user_id_idx ON app.user_research_exclusions (user_id);
