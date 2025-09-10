-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search

-- Schema
CREATE SCHEMA IF NOT EXISTS app;

-- Group roles
CREATE ROLE app_owner NOLOGIN;
CREATE ROLE app_rw    NOLOGIN;
CREATE ROLE app_ro    NOLOGIN;

-- Login roles
CREATE ROLE migrator_srv  LOGIN NOINHERIT;
CREATE ROLE api_srv       LOGIN INHERIT;
CREATE ROLE api_ro        LOGIN INHERIT;

-- Memberships
GRANT app_owner TO migrator_srv;
GRANT app_rw    TO api_srv;
GRANT app_ro    TO api_ro;

-- Schema ownership & DDL ability
ALTER SCHEMA app OWNER TO app_owner;
GRANT USAGE, CREATE ON SCHEMA app TO app_owner;

-- Runtime privileges
GRANT USAGE ON SCHEMA app TO app_rw, app_ro;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO app_rw;

GRANT SELECT ON ALL TABLES IN SCHEMA app TO app_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA app TO app_ro;

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT ON TABLES TO app_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT USAGE, SELECT ON SEQUENCES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT ON SEQUENCES TO app_ro;

-- Defaults
ALTER ROLE migrator_srv SET statement_timeout = '10min';

ALTER ROLE api_srv      SET statement_timeout = '5s';
ALTER ROLE api_srv      SET idle_in_transaction_session_timeout = '15s';

ALTER ROLE api_ro       SET statement_timeout = '5s';
ALTER ROLE api_ro       SET default_transaction_read_only = on;

ALTER ROLE api_srv      SET search_path = app, public;
ALTER ROLE api_ro       SET search_path = app, public;
ALTER ROLE migrator_srv SET search_path = app, public;