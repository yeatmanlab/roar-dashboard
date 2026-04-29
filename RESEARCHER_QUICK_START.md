# Researcher Quick Start

## Setup (3 minutes)

```bash
# 1. Start all services
docker compose -f docker-compose.local.yml up -d

# 2. Wait ~15 seconds, then set up foreign data wrapper
psql postgresql://postgres:postgres@localhost:5433/roar_core -c "CREATE EXTENSION IF NOT EXISTS postgres_fdw"
psql postgresql://postgres:postgres@localhost:5433/roar_core -c "CREATE SERVER IF NOT EXISTS assessment_server FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host 'db', dbname 'roar_assessment', port '5432')"

# 3. Run migrations
CORE_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/roar_core" \
ASSESSMENT_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/roar_assessment" \
npm run db:migrate -w apps/backend

# 4. Seed test data (optional)
npm run seed:researcher
```

## Testing (2 minutes)

### Option A: Browse Database with pgweb (Easiest)

1. Open http://localhost:8081 in your browser
2. Click **"Select Database"** dropdown at the top
3. Choose **`roar_core`** from the list
4. Click on **"Tables"** in the left sidebar
5. Explore the data:
   - **`orgs`** - View the district, school hierarchy
   - **`users`** - See teacher and student accounts
   - **`tasks`** - View the researcher task
   - **`task_variants`** - See the published variant
   - **`administrations`** - View the test administration
   - **`administration_task_variants`** - See task assignments

**Optional: View Assessment Runs**

To see sample assessment runs, create them first:

```bash
npm run seed:researcher:runs
```

Then in pgweb:
1. Switch to **`roar_assessment`** database
2. Click **`runs`** table to see the 3 sample runs created

### Option B: Query with SQL

In pgweb, click the **"Query"** tab and run:

```sql
-- View all organizations
SELECT id, name, org_type FROM app.orgs WHERE name LIKE 'Researcher%';

-- View all users
SELECT id, name_first, name_last, user_type FROM app.users WHERE name_first = 'Researcher';

-- View tasks and variants
SELECT t.id, t.name, tv.name as variant_name, tv.status
FROM app.tasks t
LEFT JOIN app.task_variants tv ON t.id = tv.task_id
WHERE t.slug = 'researcher-task';

-- View administration details
SELECT a.id, a.name, a.name_public, a.date_start, a.date_end
FROM app.administrations a
WHERE a.name = 'Researcher Administration';
```

### Option C: Test the API

```bash
# List all tasks
curl http://localhost:8080/v1/tasks

# Get a specific task
curl http://localhost:8080/v1/tasks/{taskId}
```

## Access Points

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8080 |
| Database UI (pgweb) | http://localhost:8081 |
| PostgreSQL | localhost:5433 |

## Common Commands

```bash
# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop services
docker compose -f docker-compose.local.yml down

# Check service status
docker compose -f docker-compose.local.yml ps
```

## Need Help?

See **RESEARCHER_SETUP.md** for detailed troubleshooting and advanced configuration.
