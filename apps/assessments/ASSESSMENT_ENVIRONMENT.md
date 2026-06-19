# Assessment Environment

A local developer environment for running and querying ROAR assessments against a real PostgreSQL database.

> **This guide covers the PA assessment.** Each assessment in the monorepo has its own directory (e.g. `apps/assessments/roar-pa/`) with its own scripts. The Firebase Auth emulator, backend, and PostgreSQL databases are shared across all assessments; only the assessment dev server and its port differ.

## Scripts quick reference

Run these from the assessment's directory (e.g. `apps/assessments/roar-pa/`):

| Script | What it does |
|--------|-------------|
| `npm start` | Start the assessment environment and open the dev server |
| `npm stop` | Stop the environment and delete the local database |
| `npm restart` | Restart the environment (use when something seems stuck) |
| `npm run update` | Rebuild platform libraries after pulling new code, then start |
| `npm run rebuild` | Rebuild Docker images from scratch (rarely needed — see below) |

The other scripts in `package.json` (`build`, `build:staging`, `build:production`, `dev`, etc.) are for CI and platform developers. You can ignore them.

## What it starts (PA)

| Process | URL |
|---------|-----|
| Firebase Auth emulator | http://localhost:9099 |
| ROAR backend (HTTP) | http://localhost:4000 |
| PA assessment dev server | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

Two databases are created: `roar_core` (users, tasks, runs) and `roar_assessment` (trials, scores).

## Prerequisites

- **Docker** with Compose v2 (`docker compose version` should work)
- **Port 5432 free** — the assessment database binds to the standard Postgres port. If you have a local Postgres instance running, stop it first:
  - macOS (Homebrew): `brew services stop postgresql@<version>`
  - Ubuntu/Debian: `sudo systemctl stop postgresql`

## Starting the environment

From the assessment's directory (e.g. `apps/assessments/roar-pa` for PA):

```bash
npm start
```

**Ctrl+C** stops only the assessment dev server. The Docker services (database, backend, Firebase emulator) keep running in the background — your data is preserved. Run `npm start` again to restart the dev server against the same database.

To stop all Docker services **and permanently delete the database**:

```bash
npm stop
```

## Configuring task variants

Each assessment reads a local **`taskVariantParameters.json`** file to determine which task variants to seed into the ephemeral database. The file is not committed to git — copy the example to get started:

```bash
cp apps/assessments/roar-swr/taskVariantParameters.example.json \
   apps/assessments/roar-swr/taskVariantParameters.json
```

The file is a JSON array. Each entry defines one variant to seed:

```json
[
  {
    "variantName": "English (v7)",
    "params": {
      "lng": "en",
      "scoringVersion": 7,
      "userMode": "shortAdaptive"
    }
  }
]
```

The keys in `params` map directly to the URL parameters you would pass to the assessment dev server. The example file documents all available parameters with their valid values and sensible defaults.

**Tasks are derived automatically** — the seed creates a task row for each unique `lng` value in the file. There is no separate task config needed.

**Re-seeding is additive.** Variants are matched by name. If you add a new entry to `taskVariantParameters.json` and restart the environment, the new variant is seeded alongside the existing ones. Use `variantId=<id>` in the dev server URL to target a specific variant.

**Validation** runs at seed time. The seed will fail with a descriptive error if `taskVariantParameters.json` is missing, contains unknown parameter keys, or has invalid values.

---

## Rebuilding the Docker images

Docker caches build layers, so changes to files that are copied into the image are sometimes not picked up by a normal start. Force a clean rebuild with:

```bash
npm run rebuild
```

Run this after making changes to any of the following:

- `assessment.Dockerfile`
- `apps/backend/` — source, migrations, seeds, or dependencies
- `packages/api-contract/` — shared API types and Zod schemas
- `packages/assessment-schema/` — shared assessment data schemas
- Root `package.json` / `package-lock.json` — dependency changes

The environment does not need to be stopped first — the rebuild only updates the images. Run `npm start` afterward to start the environment with the new images.

---

## Querying your data

### PgWeb (recommended)

PgWeb is a browser-based SQL client — no configuration files, no GUI to install, just a URL.

**Install:**

```bash
# macOS
brew install pgweb

# Linux / other — download the binary from https://github.com/sosedoff/pgweb/releases
```

**Connect to `roar_core`** (users, tasks, runs):

```bash
pgweb --url "postgres://postgres@localhost:5432/roar_core?sslmode=disable"
```

Open http://localhost:8081 in your browser.

**Connect to `roar_assessment`** (trials, scores):

```bash
pgweb --url "postgres://postgres@localhost:5432/roar_assessment?sslmode=disable"
```

To browse both databases at once, run a second `pgweb` on a different port:

```bash
pgweb --url "postgres://postgres@localhost:5432/roar_assessment?sslmode=disable" --listen 8082
```

---

### Database layout

All tables live in the `app` schema — prefix every table name with `app.`.

User and task data (`app.users`, `app.tasks`, `app.task_variants`) lives in **`roar_core`**.
Trial and score data (`app.run_trials`, `app.run_scores`) lives in **`roar_assessment`**.
Run records (`app.runs`) live in **`roar_assessment`** but are also accessible from `roar_core` via a foreign data wrapper at `app_assessment_fdw.runs` — use that when you need to join runs against users or tasks.

### Useful queries

**All runs for the PA task** — run in `roar_core`:

```sql
SELECT
  r.id,
  u.name_first,
  u.name_last,
  r.completed_at,
  r.reliable_run
FROM app_assessment_fdw.runs r
JOIN app.users u ON u.id = r.user_id
JOIN app.task_variants tv ON tv.id = r.task_variant_id
JOIN app.tasks t ON t.id = tv.task_id
WHERE t.slug = 'pa'
  AND r.deleted_at IS NULL
ORDER BY r.created_at DESC;
```

**Trial-level data for a specific run** — run in `roar_assessment`:

```sql
SELECT
  trial_num_total,
  item,
  correct,
  response,
  response_time_ms,
  subtask
FROM app.run_trials
WHERE run_id = '<your-run-id>'
ORDER BY trial_num_total;
```

**Scores for completed runs** — run in `roar_assessment`:

```sql
SELECT
  r.id AS run_id,
  s.domain,
  s.name,
  s.value,
  s.category_score
FROM app.run_scores s
JOIN app.runs r ON r.id = s.run_id
WHERE r.completed_at IS NOT NULL
  AND r.deleted_at IS NULL
ORDER BY r.completed_at DESC;
```

---

### Alternatives

**psql** (command-line, no install needed if Postgres is already on your machine):

```bash
psql "postgres://postgres@localhost:5432/roar_core?sslmode=disable"
```

**pgcli** (command-line with autocomplete):

```bash
brew install pgcli   # macOS
pgcli postgres://postgres@localhost:5432/roar_core
```

**PgAdmin** (full desktop GUI):
Download from https://www.pgadmin.org. Create a new server with host `localhost`, port `5432`, username `postgres`, and leave the password blank.

---

## Connection reference

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `5432` |
| Username | `postgres` |
| Password | *(none)* |
| Core database | `roar_core` |
| Assessment database | `roar_assessment` |
| SSL mode | `disable` |
