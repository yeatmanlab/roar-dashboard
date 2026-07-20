# Assessment Environment — Setup & Operations

A local developer environment for running ROAR assessments against a real PostgreSQL database, a real backend, and the Firebase emulators — no cloud credentials required.

This is the **setup and operations** guide: how to install, start, stop, seed, and troubleshoot the environment. For querying the data you produce (runs, trials, scores, metadata) and the day-to-day research loop, see the companion **[Research Guide](./ASSESSMENT_RESEARCH_GUIDE.md)**.

> **The environment is shared across all assessments.** Each assessment lives in its own directory (e.g. `apps/assessments/roar-pa/`) and runs its own dev server, but the Firebase emulators (Auth + Storage), backend, and PostgreSQL databases are one shared Docker stack. Only the assessment dev server differs — they all run on the same port (http://localhost:8000), one at a time.

---

## TL;DR

From the assessment's directory (e.g. `apps/assessments/roar-pa/`):

```bash
npm run setup    # First time only: check prerequisites, install, build, create config
npm start        # Start the environment and open the dev server
```

After that, `npm start` is all you need for day-to-day work. Everything else is in the [script reference](#script-reference) below.

---

## Prerequisites

`npm run setup` checks these for you and prints fix-it instructions, but for reference:

- **Node dependencies** — installed with `npm install` from the monorepo root (setup does this).
- **Docker** with Compose v2 (`docker compose version` should work). If you don't have it:
  - macOS: `brew install --cask docker`, then launch Docker Desktop (Compose v2 is bundled). Or download from https://www.docker.com/products/docker-desktop/.
  - Ubuntu/Debian: `curl -fsSL https://get.docker.com | sh`, then `sudo usermod -aG docker $USER` and log out/in so you can run Docker without `sudo`. See https://docs.docker.com/engine/install/ubuntu/ for the manual apt steps.
- **Port 5433 free** — the ephemeral database publishes on host port **5433** by default (deliberately not the standard 5432), so it can run alongside a persistent platform-dev Postgres on 5432. If something already holds 5433, free it or set `ASSESSMENT_PG_PORT` to another port:
  - Find it: `lsof -i :5433` (macOS) / `ss -tlnp | grep :5433` (Linux)
  - Usual cause is a leftover assessment container: `docker ps | grep 5433`

---

## First-time setup: `npm run setup`

Run once from the assessment directory, before your first `npm start`:

```bash
cd apps/assessments/roar-pa
npm run setup
```

It walks through four steps and finishes by pointing you at the next command:

1. **Checks Docker** (Compose v2). If missing, prints install options and flags it as a blocker — but keeps going, since the remaining steps don't need Docker.
2. **Checks the ephemeral Postgres host port is free** (`ASSESSMENT_PG_PORT`, default 5433). If it's taken, prints how to find the holder and flags it as a blocker.
3. **Installs dependencies and builds the platform libraries** from the repo root (`api-contract`, `assessment-schema`, `scoring-tables`, `assessment-sdk`). The assessment dev server bundles these from their built output, so they must exist before the first start. This step can take a few minutes.
4. **Creates `taskVariantParameters.json`** from the committed example (never overwrites an existing one — see [Configuring task variants](#configuring-task-variants)).

Any Docker/port blocker is re-printed in a summary at the end so you resolve it before starting. Once setup is happy, run `npm start`.

> Docker and the Postgres host port are **checked but not required** to finish setup — install/build/copy all run regardless, so you can prep the repo now and sort out Docker later.

---

## Starting and stopping

```bash
npm start      # Start the shared stack (if needed) and the assessment dev server
```

**Ctrl+C stops only the assessment dev server.** The Docker services (database, backend, Firebase emulators) keep running in the background and your data is preserved. Run `npm start` again to reattach the dev server to the same database — it detects the running stack and skips straight to the dev server.

```bash
npm stop       # Stop ALL Docker services and permanently DELETE the database
```

`npm stop` tears down the containers **and their volumes** — every run, trial, score, and uploaded recording is gone. Use it when you want a clean slate; don't use it to "restart."

---

## Script reference

Run all of these from the assessment's directory. This is the whole surface — the other scripts in `package.json` (`build`, `build:staging`, `dev`, etc.) are for CI and platform developers; ignore them.

| Script               | What it does                                                                             | When to use                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`      | Check prerequisites, install deps, build platform libraries, create the config file      | Once, on first setup (or on a fresh clone)                                                                                    |
| `npm start`          | Start the shared stack (if not already up) and the assessment dev server                 | Every time you sit down to work                                                                                               |
| `npm run seed:tasks` | Seed **new** variants from `taskVariantParameters.json` into the running DB, no teardown | After editing `taskVariantParameters.json`, to pick up new variants **without losing your data**                              |
| `npm stop`           | Stop all Docker services and delete the database volume                                  | When you want a completely clean slate                                                                                        |
| `npm restart`        | `npm stop && npm start` — full teardown (including data) and fresh start                 | When the stack is wedged and `seed:tasks` isn't the issue. **Destroys your data**                                             |
| `npm run update`     | Rebuild the host platform libraries (SDK / schema / scoring-tables)                      | After `git pull` brings changes to those packages (see [Updating after a pull](#updating-after-a-pull))                       |
| `npm run rebuild`    | Force a no-cache rebuild of the Docker images                                            | After changes to the backend, migrations, Dockerfile, or shared deps (see [Rebuilding images](#rebuilding-the-docker-images)) |

---

## What it starts

| Process                                         | URL                   |
| ----------------------------------------------- | --------------------- |
| Firebase emulator — Auth                        | http://localhost:9099 |
| Firebase emulator — Storage (recording uploads) | http://localhost:9199 |
| Firebase emulator — UI (browse recordings)      | http://localhost:9000 |
| ROAR backend (HTTP)                             | http://localhost:4000 |
| Assessment dev server                           | http://localhost:8000 |
| PostgreSQL                                      | localhost:5433        |

The services start in dependency order: database (healthy) → migrations + task seed (completed) → Firebase emulators (healthy) → backend (healthy) → the dev server on your host. Storage only matters for assessments that record audio/video (e.g. Read Aloud) — see the Research Guide's [Viewing recordings](./ASSESSMENT_RESEARCH_GUIDE.md#viewing-recordings-audiovideo-assessments).

### Two databases

Two databases are created, and knowing which holds what is the thing that trips people up when writing queries:

| Database          | Holds                                                        |
| ----------------- | ------------------------------------------------------------ |
| `roar_core`       | `users`, `tasks`, `task_variants`, `task_variant_parameters` |
| `roar_assessment` | `runs`, `run_trials`, `run_scores`, `run_trial_interactions` |

`runs` and `run_scores` are also mirrored into `roar_core` via a foreign data wrapper (`app_assessment_fdw.runs`, `app_assessment_fdw.run_scores`) so you can join them against users and tasks in a single query. **`run_trials` is not mirrored** — trial-level data is only queryable in `roar_assessment`. Connection details and query examples are in the [Research Guide](./ASSESSMENT_RESEARCH_GUIDE.md#querying-your-data).

> **Port 5433, not 5432.** This ephemeral stack publishes Postgres on host port **5433** by default so it can run at the same time as a persistent platform-dev Postgres on 5432 (many platform developers keep both). Override with `ASSESSMENT_PG_PORT` if 5433 is taken — Compose and the scripts read the same variable.

---

## Configuring task variants

Each assessment reads a local **`taskVariantParameters.json`** to decide which task variants to seed into the database. The file is **not committed** (it's gitignored) and is **required before the first start** — `npm run setup` creates it for you from the committed example, or copy it yourself from the assessment's directory:

```bash
cp taskVariantParameters.example.json taskVariantParameters.json
```

The file is a JSON array; each entry defines one variant to seed:

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

The keys in `params` map directly to the URL parameters the assessment dev server understands. The committed `taskVariantParameters.example.json` documents every available parameter with its valid values and sensible defaults.

### How seeding works

When the stack first comes up, a one-shot migration container runs the database migrations and then seeds this assessment's task(s) and variants. It's driven by the assessment's directory name — `roar-pa` → the `roar-pa` seed config — so **an unregistered assessment fails the migration container** rather than the dev server, naming the tasks it knows about.

Each assessment has a seed config in `apps/backend/seeds/configs/<name>.config.ts` that defines:

- the **task(s)** the variants belong to (single-task assessments have one; multi-task assessments route each variant to a task from its params),
- the **allowed parameter keys**, and
- a **validation function**.

**Validation runs at seed time.** Seeding fails with a descriptive error if `taskVariantParameters.json` is missing, contains an unknown parameter key, or has an invalid value — the rules come from that config, not from a generic schema.

Variants are seeded as `published` and matched by name, so seeding is **idempotent and additive**: a variant that already exists is skipped, and a new entry is added alongside the existing ones. To target a specific variant when playing the assessment, pass `variantId=<id>` in the dev server URL — or use the [variant picker](./ASSESSMENT_RESEARCH_GUIDE.md#switching-variants-the-variant-picker).

### Adding or changing variants without losing data

Here's the catch: the seed only runs automatically **once**, inside that migration container at bring-up. Editing `taskVariantParameters.json` afterward and running `npm start` again does **nothing** — when the stack is already up, `npm start` skips straight to the dev server and never re-runs the seed. And `npm restart` / `npm stop` re-seed only because they wipe the database volume first, taking every run/trial/score you've generated with them.

Use **`npm run seed:tasks`** instead. It runs the same idempotent, additive-by-name seeder against the **live** database, so newly added variants appear immediately while your generated data stays put:

```bash
# 1. Edit taskVariantParameters.json — add a new entry
# 2. Seed it into the running environment (no teardown, no data loss)
npm run seed:tasks
# 3. Reload the assessment (or use the variant picker) to see the new variant
```

It requires the environment to be running (`npm start` first) — it seeds into the live container database. This is the recommended way to iterate on variants.

---

## Updating after a pull

After `git pull` brings in new code, which command you need depends on what changed:

- **Platform libraries the dev server bundles** (`assessment-sdk`, `assessment-schema`, `scoring-tables`): run **`npm run update`** to rebuild them on the host, then restart the dev server (Ctrl+C, `npm start`). Which libraries `update` rebuilds varies by assessment — check its `package.json`.
- **Backend, migrations, `api-contract`, the Dockerfile, or root dependencies**: these run inside the Docker images, so run **`npm run rebuild`** (see below).
- **The `assessment-schema` package** is used by _both_ the host dev server and the backend, so a change there can need **both** `update` and `rebuild`.

When in doubt after a large pull, `npm run rebuild` then `npm run update` is the safe combination.

---

## Rebuilding the Docker images

Docker caches build layers, so changes to files copied into an image aren't always picked up by a normal start. Force a clean rebuild with:

```bash
npm run rebuild
```

Run this after changing any of the following:

- `assessment.Dockerfile`
- `apps/backend/` — source, migrations, seeds, or dependencies
- `packages/api-contract/` — shared API types and Zod schemas
- `packages/assessment-schema/` — shared assessment data schemas
- Root `package.json` / `package-lock.json` — dependency changes

The environment doesn't need to be stopped first — the rebuild only updates the images. Run `npm start` afterward to bring the environment up with the new images.

---

## Troubleshooting

**"Port 5433 is already in use."** Something is holding the ephemeral database's host port — usually a leftover assessment container (`docker ps | grep 5433`) or, rarely, another service. Stop it, or run with a different port: `ASSESSMENT_PG_PORT=<port> npm start`.

**"Port 8000 is already in use."** A previous dev server (or another assessment) is still running. Stop that process, then `npm start`.

**"taskVariantParameters.json not found."** You skipped the config step. Run `npm run setup`, or copy the example manually (see [Configuring task variants](#configuring-task-variants)).

**The migration container failed / "Unknown task."** The assessment isn't registered in the seed config registry, or its `taskVariantParameters.json` has an invalid parameter. The error names the available tasks and the offending key. Fix the config or the params file, then `npm run rebuild` and `npm start`.

**"My new variant didn't show up."** Editing `taskVariantParameters.json` doesn't re-seed on its own. Run `npm run seed:tasks` (preserves your data) rather than `npm restart` (wipes it). See [Adding or changing variants without losing data](#adding-or-changing-variants-without-losing-data).

**Want a clean slate but keep your seeded variants?** Truncate the run tables (`TRUNCATE app.runs CASCADE` in `roar_assessment`) instead of `npm restart` — it clears your generated runs/trials/scores in one step without re-seeding. See the Research Guide's [Resetting your generated data](./ASSESSMENT_RESEARCH_GUIDE.md#resetting-your-generated-data).

**A code change isn't taking effect.** Host library change → `npm run update`; backend/migration/Dockerfile change → `npm run rebuild`. See [Updating after a pull](#updating-after-a-pull).

**Stale containers / name or port conflicts on start.** `npm start` force-removes known stale containers before bringing the stack up, but if it's still wedged, `npm stop` (deletes data) then `npm start` gives a clean slate.

**`docker stop` fails with "permission denied" (Linux/AppArmor).** `npm stop` falls back to direct process kills and, if those are blocked too, prints the exact `sudo kill` command to run. Run it, then re-run `npm stop`.

---

## Connection reference

| Setting             | Value                         |
| ------------------- | ----------------------------- |
| Host                | `localhost`                   |
| Port                | `5433` (`ASSESSMENT_PG_PORT`) |
| Username            | `postgres`                    |
| Password            | _(none)_                      |
| Core database       | `roar_core`                   |
| Assessment database | `roar_assessment`             |
| SSL mode            | `disable`                     |

For clients, queries, and the metadata fields, continue to the **[Research Guide](./ASSESSMENT_RESEARCH_GUIDE.md)**.
