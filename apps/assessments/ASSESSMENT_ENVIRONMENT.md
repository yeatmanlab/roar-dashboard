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

Because the teardown is irreversible, both `npm stop` and `npm restart` **prompt for confirmation** before wiping the database. Declining is clean — it exits without an error and changes nothing: `npm stop` doesn't tear down, and `npm restart` neither tears down nor starts. Bypass the prompt with `npm run stop -- --yes` (or `npm run restart -- --yes`); non-interactive shells (CI, pipes) proceed without prompting.

---

## Switching between assessments

The Docker stack — database, backend, and Firebase emulators — is **shared across all assessments** and keeps running in the background; only the dev server on port 8000 is per-assessment. So moving from one assessment to another (say `roar-swr` → `roar-pa`) tears nothing down:

1. **Stop the current dev server** with Ctrl+C — frees port 8000; the stack and your data stay up.
2. **`cd` to the other assessment** (e.g. `cd ../roar-pa`).
3. **Seed it into the running database:** `npm run seed:tasks`. The stack only auto-seeds the _first_ assessment that brought it up, so each additional assessment you switch to needs its task(s)/variants seeded once — until then it starts but can't resolve a variant. (First time on that assessment, create its config first: `cp taskVariantParameters.example.json taskVariantParameters.json`.)
4. **`npm start`** — it detects the running stack and launches this assessment's dev server against the same database.

A few things follow from the stack being shared and persistent:

- **Switching back needs no re-seed.** Seeding is additive and the database persists — it survives Ctrl+C; only `npm stop` / `npm restart` wipe it. Once an assessment is seeded, returning to it is just Ctrl+C → `cd` → `npm start`.
- **Runs from both assessments coexist** in the same database — handy for cross-assessment work.
- **No full `npm run setup` needed.** The platform libraries are built once at the repo root and shared, so only the per-assessment `taskVariantParameters.json` (and its seed) is assessment-specific. Running `setup` mid-switch would also spuriously flag port 5433 as "in use" — that's your own running stack.
- **If you fully stopped the stack** (`npm stop`) between assessments, skip step 3: the next `npm start` brings the stack up fresh and auto-seeds whichever assessment you start it from.

---

## Script reference

Run all of these from the assessment's directory. This is the whole surface — the other scripts in `package.json` (`build`, `build:staging`, `dev`, etc.) are for CI and platform developers; ignore them.

| Script               | What it does                                                                             | When to use                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`      | Check prerequisites, install deps, build platform libraries, create the config file      | Once, on first setup (or on a fresh clone)                                                                                    |
| `npm start`          | Start the shared stack (if not already up) and the assessment dev server                 | Every time you sit down to work                                                                                               |
| `npm run seed:tasks` | Seed **new** variants from `taskVariantParameters.json` into the running DB, no teardown | After editing `taskVariantParameters.json`, to pick up new variants **without losing your data**                              |
| `npm stop`           | Stop all Docker services and delete the database volume                                  | When you want a completely clean slate                                                                                        |
| `npm restart`        | Confirmed full teardown (**deletes data**) and fresh start                               | When the stack is wedged and `seed:tasks` isn't the issue. **Destroys your data**                                             |
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

The services start in dependency order: the database comes up first and the one-shot migration + task seed container waits for it to report healthy. The Firebase emulators have no dependency of their own, so they start alongside those two. The backend waits for **both** — the seed to complete and the emulators to be healthy — and the dev server on your host starts last. Storage only matters for assessments that record audio/video (e.g. Read Aloud) — see the Research Guide's [Viewing recordings](./ASSESSMENT_RESEARCH_GUIDE.md#viewing-recordings-audiovideo-assessments).

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
    "variantName": "English-v7",
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

Variants are seeded as `published` and matched by name, so seeding is **idempotent and additive**: a variant that already exists is skipped, and a new entry is added alongside the existing ones. To target a specific variant when playing the assessment, pass `variantId=<id>` in the dev server URL — or use the [variant picker](./ASSESSMENT_RESEARCH_GUIDE.md#switching-variants-the-variant-picker). With no `variantId`, the assessment loads its declared default — see [Choosing which variant loads by default](#choosing-which-variant-loads-by-default).

### Choosing which variant loads by default

Opening the dev server without a `variantId` in the URL used to run whichever variant happened to be seeded first. Each assessment now declares a **preferred default variant per task, by name**, in its `serve/serve.js`:

```javascript
// apps/assessments/roar-pa/serve/serve.js
const DEFAULT_VARIANT_NAMES = {
  [pa.PA_TASK_ID]: "English-Fixed-v3",
};
```

Resolution order when the page loads:

1. **`variantId` in the URL** wins, and is used directly with no lookup.
2. Otherwise the task's **`DEFAULT_VARIANT_NAMES` entry**, matched **case-insensitively** against the task's published variant names. `task_variants` is uniquely indexed on `(taskId, lower(name))`, so a name identifies at most one variant per task.
3. Otherwise — no entry for that task — the **oldest published variant**, the behaviour that predates named defaults. The SDK warns in the browser console when it takes this path and the task has more than one published variant, since the choice is then made by seeding order rather than by intent.

**Set your own default by editing that map.** The committed values are placeholders lifted from `taskVariantParameters.example.json`. If you seed variants under names of your own, revise `DEFAULT_VARIANT_NAMES` to match — otherwise your declared default won't resolve.

**When a declared default doesn't resolve**, what happens depends on the build. The policy comes from `unresolvedDefaultVariantPolicy` in `apps/assessments/shared/roarDbMode.js`:

| Build                | Behaviour                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Local development    | **Warns** in the browser console and falls back to the oldest published variant                              |
| Staging / production | **Throws** — a typo or a renamed variant fails loudly rather than silently running a different configuration |

Local leniency is deliberate: your own seed need not contain the canonical variant for the assessment you're working on. But it also means a mismatch is **quiet** — you still get a run, just not the one you meant. Both the warning and the error list every published variant name for the task, so **check the browser console** whenever the assessment isn't running the variant you expected.

> **Keep variant names simple.** Defaults are matched by name, and names are also passed on the command line (`npm run dev:assign:variant -- --variant 'English-v7'`). Hyphenated ASCII names avoid quoting and URL-encoding friction — which is why the committed examples use `English-v7` rather than `English (v7)`.

> **Two different "defaults" — don't confuse them.** `DEFAULT_VARIANT_NAMES` in `serve/serve.js` is the one standalone play resolves, and the one this section is about. Separately, four seed configs (`roar-pa`, `roar-swr`, `roar-sre`, `roar-letter`) declare a `defaultVariant`, which the seeder assigns to the **dashboard's** dev launch-sandbox administration — irrelevant to playing at `localhost:8000`. Renaming your variants makes the seeder warn that the config's `defaultVariant` isn't in your parameters file; that warning is about the sandbox assignment, not about which variant your dev server will load.

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

**Seeding printed "Launch sandbox administration not found."** Benign, and expected in this environment. Four assessments (`roar-pa`, `roar-swr`, `roar-sre`, `roar-letter`) declare a `defaultVariant` in their seed config, which the seeder tries to assign to the dashboard's dev launch-sandbox administration. That fixture isn't seeded here, so the assignment is skipped and the message says so — the message even names this stack as the expected case. Your variants are still seeded and playable.

**Seeding warned that a `defaultVariant` "is not in the parameters file."** Also benign for standalone play. It means your `taskVariantParameters.json` no longer contains the variant the seed config names, so the launch-sandbox assignment was skipped. It does not affect which variant `localhost:8000` loads — see [Choosing which variant loads by default](#choosing-which-variant-loads-by-default).

**A code change isn't taking effect.** Host library change → `npm run update`; backend/migration/Dockerfile change → `npm run rebuild`. See [Updating after a pull](#updating-after-a-pull).

**"Failed to bind host port 9000/9099/9199" — or the Firebase emulator container never starts.** Another Firebase emulator already holds those ports. The usual culprit is a persistent platform-dev stack (its auth emulator publishes 9099) or a hand-started `firebase emulators:start`; this stack publishes all three on the host, so the two cannot run at once. Stop the other emulator, then `npm start`. One wrinkle if the first attempt already created the container: starting it again can leave it running with no published ports (`docker port firebase-emulator` prints nothing, and the emulator is unreachable from the host even though the container reports healthy). Recreate it rather than restarting it — `docker compose -f docker-compose.assessment.yml up -d --force-recreate firebase-emulator`.

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
