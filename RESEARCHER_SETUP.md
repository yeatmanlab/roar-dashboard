# Researcher Local Environment Setup

This guide helps researchers run the ROAR assessment platform locally using Docker Compose with minimal setup.

## Overview

The researcher environment provides:
- **PostgreSQL database** with pre-configured schemas
- **Backend API** running on `http://localhost:8080`
- **pgweb** database UI on `http://localhost:8081` for easy DB inspection
- **Minimal seed data** for testing typical assessment flows

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Git** (to clone the repository)
- ~2GB disk space for Docker images and database

## Quick Start

### 1. Clone and Navigate

```bash
git clone <repository-url>
cd roar-dashboard
```

### 2. Start the Environment

```bash
docker compose -f docker-compose.local.yml up -d
```

This command:
- Creates and starts PostgreSQL, backend API, and pgweb services
- Initializes three databases: `roar_core`, `roar_assessment`, `roar_openfga`
- Waits for PostgreSQL to be healthy before starting the backend

### 3. Run Database Migrations

In a new terminal:

```bash
# Create the postgres_fdw extension (required for migrations)
psql postgresql://postgres:postgres@localhost:5433/roar_core -c "CREATE EXTENSION IF NOT EXISTS postgres_fdw"

# Create the assessment_server foreign data wrapper
psql postgresql://postgres:postgres@localhost:5433/roar_core -c "CREATE SERVER IF NOT EXISTS assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host 'localhost', dbname 'roar_assessment', port '5433')"

# Run migrations
CORE_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/roar_core" \
ASSESSMENT_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/roar_assessment" \
npm run db:migrate -w apps/backend
```

This applies all pending migrations to the databases.

### 4. Seed Minimal Test Data (Optional)

To populate the database with a basic researcher setup (one district, school, class, teacher, student, task, and administration):

```bash
psql postgresql://postgres:postgres@localhost:5433/roar_core < scripts/seed-researcher-simple.sql
```

This creates:
- **Organization hierarchy**: District → School → Class
- **Users**: One teacher and one student (grade 5)
- **Task**: A sample task with one published variant
- **Administration**: Assigned to the district with the task variant included

### 5. Verify Everything Works

Check that all services are running:

```bash
docker compose -f docker-compose.local.yml ps
```

Expected output:
```
NAME                      STATUS
roar-researcher-db        Up (healthy)
roar-researcher-backend   Up (healthy)
roar-researcher-pgweb     Up
```

## Accessing Services

### Backend API

**URL**: `http://localhost:8080`

Example request to list tasks:
```bash
curl http://localhost:8080/v1/tasks
```

### Database Viewer (pgweb)

**URL**: `http://localhost:8081`

- **Host**: `db` (or `localhost` if connecting from outside Docker)
- **Port**: `5432`
- **Username**: `postgres` (default)
- **Password**: `postgres` (default)
- **Database**: `roar_core` (or `roar_assessment`)

pgweb provides a web interface to:
- Browse tables and schemas
- Run SQL queries
- View table contents
- Export data

### Direct Database Access

If you prefer command-line access:

```bash
# Connect to core database
psql postgresql://postgres:postgres@localhost:5432/roar_core

# Connect to assessment database
psql postgresql://postgres:postgres@localhost:5432/roar_assessment
```

## Configuration

### Environment Variables

The Docker Compose setup uses default credentials. To customize, create a `.env.local` file in the project root:

```bash
# Database credentials
PG_USER=postgres
PG_PASSWORD=postgres

# Backend configuration (optional)
GOOGLE_CLOUD_PROJECT=roar-local
```

Then start with:
```bash
docker compose -f docker-compose.local.yml up -d
```

### Ports

| Service | Port | URL |
|---------|------|-----|
| PostgreSQL | 5432 | `postgresql://localhost:5432` |
| Backend API | 8080 | `http://localhost:8080` |
| pgweb | 8081 | `http://localhost:8081` |

To use different ports, edit `docker-compose.local.yml` before starting.

## Common Tasks

### View Logs

```bash
# All services
docker compose -f docker-compose.local.yml logs -f

# Specific service
docker compose -f docker-compose.local.yml logs -f backend
docker compose -f docker-compose.local.yml logs -f db
```

### Stop Services

```bash
docker compose -f docker-compose.local.yml down
```

This stops all containers but preserves the database volume.

### Remove Everything (Including Data)

```bash
docker compose -f docker-compose.local.yml down -v
```

⚠️ This deletes all data. Use with caution.

### Restart a Service

```bash
docker compose -f docker-compose.local.yml restart backend
```

### Run Migrations Again

If you need to re-run migrations (e.g., after pulling new schema changes):

```bash
npm run db:migrate -w apps/backend
```

### Re-seed Data

To clear and re-seed the database:

```bash
# Stop services
docker compose -f docker-compose.local.yml down

# Remove the database volume
docker volume rm roar-researcher-db-data

# Start services again
docker compose -f docker-compose.local.yml up -d

# Wait for PostgreSQL to be healthy, then migrate and seed
npm run db:migrate -w apps/backend
npm run seed:researcher
```

## Troubleshooting

### Backend won't start / "connection refused"

**Problem**: Backend container exits or can't connect to database.

**Solution**:
1. Check PostgreSQL is healthy: `docker compose -f docker-compose.local.yml ps`
2. View logs: `docker compose -f docker-compose.local.yml logs backend`
3. Ensure migrations ran: `npm run db:migrate -w apps/backend`
4. Restart: `docker compose -f docker-compose.local.yml restart backend`

### "Database does not exist" error

**Problem**: Migrations fail because databases weren't created.

**Solution**:
1. The initialization script should create them automatically
2. If not, manually create them:
   ```bash
   psql postgresql://postgres:postgres@localhost:5432 -c "CREATE DATABASE roar_core;"
   psql postgresql://postgres:postgres@localhost:5432 -c "CREATE DATABASE roar_assessment;"
   ```
3. Re-run migrations: `npm run db:migrate -w apps/backend`

### pgweb can't connect to database

**Problem**: pgweb shows "connection refused" or "database not found".

**Solution**:
1. Ensure PostgreSQL is running: `docker compose -f docker-compose.local.yml ps`
2. Check the database exists: `psql postgresql://postgres:postgres@localhost:5432 -l`
3. Verify the connection string in pgweb matches your setup
4. Restart pgweb: `docker compose -f docker-compose.local.yml restart pgweb`

### Port already in use

**Problem**: "Address already in use" when starting services.

**Solution**:
1. Find what's using the port: `lsof -i :8080` (macOS/Linux)
2. Either:
   - Stop the conflicting service
   - Edit `docker-compose.local.yml` to use different ports
   - Use `docker compose -f docker-compose.local.yml down` to stop all containers

### Slow database queries

**Problem**: Queries are slow or timeouts occur.

**Solution**:
1. Check available disk space: `df -h`
2. Check Docker resource limits: `docker stats`
3. Increase Docker memory allocation if needed
4. Add indexes for frequently queried columns (see schema documentation)

## Testing Assessment Flows

Once the environment is running and seeded, you can test assessment flows:

### 1. List Available Tasks

```bash
curl http://localhost:8080/v1/tasks
```

### 2. Get Task Variants

```bash
curl http://localhost:8080/v1/tasks/{taskId}/variants
```

### 3. Create an Administration (via pgweb or API)

Use pgweb to inspect the `administrations` table and see the seeded administration.

### 4. Inspect User Enrollments

Query the database to see user-org and user-class relationships:

```sql
-- View all users
SELECT id, name_first, name_last, user_type FROM app.users;

-- View user-org assignments
SELECT u.name_first, u.name_last, o.name, uo.role
FROM app.user_orgs uo
JOIN app.users u ON uo.user_id = u.id
JOIN app.orgs o ON uo.org_id = o.id;

-- View user-class assignments
SELECT u.name_first, u.name_last, c.name, uc.role
FROM app.user_classes uc
JOIN app.users u ON uc.user_id = u.id
JOIN app.classes c ON uc.class_id = c.id;
```

## Next Steps

- **Explore the API**: Check `packages/api-contract/src/v1/` for available endpoints
- **Review the schema**: Use pgweb to explore table structures and relationships
- **Run tests**: `npm run test -w apps/backend` (requires additional setup)
- **Check logs**: Monitor `docker compose logs -f` while making requests

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker logs: `docker compose -f docker-compose.local.yml logs`
3. Consult the main README for development setup details
4. Open an issue on the repository

## Additional Resources

- **Docker Compose Documentation**: https://docs.docker.com/compose/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **pgweb Documentation**: https://github.com/sosedoff/pgweb
- **ROAR Platform Documentation**: See the main README.md
