-- ════════════════════════════════════════════════════════════════════════════
-- Researcher Local Database Initialization
-- ════════════════════════════════════════════════════════════════════════════
-- This script creates the necessary databases for the researcher environment.
-- It runs automatically when the PostgreSQL container starts.

-- Create core database
CREATE DATABASE roar_core;

-- Create assessment database
CREATE DATABASE roar_assessment;

-- Create OpenFGA database (optional, for authorization testing)
CREATE DATABASE roar_openfga;

-- Grant permissions to the current user (respects PG_USER env var)
GRANT ALL PRIVILEGES ON DATABASE roar_core TO CURRENT_USER;
GRANT ALL PRIVILEGES ON DATABASE roar_assessment TO CURRENT_USER;
GRANT ALL PRIVILEGES ON DATABASE roar_openfga TO CURRENT_USER;

-- Verify databases were created
SELECT datname FROM pg_database WHERE datname LIKE 'roar%' ORDER BY datname;
