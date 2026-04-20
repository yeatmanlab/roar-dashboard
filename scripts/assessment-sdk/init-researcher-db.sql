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

-- Grant permissions to the postgres user
GRANT ALL PRIVILEGES ON DATABASE roar_core TO postgres;
GRANT ALL PRIVILEGES ON DATABASE roar_assessment TO postgres;
GRANT ALL PRIVILEGES ON DATABASE roar_openfga TO postgres;

-- Verify databases were created
SELECT datname FROM pg_database WHERE datname LIKE 'roar%' ORDER BY datname;
