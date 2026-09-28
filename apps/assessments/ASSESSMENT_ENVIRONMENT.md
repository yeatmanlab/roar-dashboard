# Assessment Environment — Setup & Operations

A local developer environment for running ROAR assessments against a real PostgreSQL database, a real backend, and the Firebase emulators — no cloud credentials required.

This is the **setup and operations** guide: how to install, start, stop, seed, and troubleshoot the environment. For querying the data you produce (runs, trials, scores, metadata) and the day-to-day research loop, see the companion **[Research Guide](./ASSESSMENT_RESEARCH_GUIDE.md)**.

> **The environment is shared across all assessments.** Each assessment lives in its own directory (e.g. `apps/assessments/roar-swr/`) and runs its own dev server, but the Firebase emulators (Auth + Storage), backend, and PostgreSQL databases are one shared Docker stack. Only the assessment dev server differs — they all run on the same port (http://localhost:8000), one at a time.

---

## TL;DR

From the assessment's directory (e.g. `apps/assessments/roar-swr/`):

```bash
npm run setup    # First time only: check prerequisites, install, build, create config
npm start        # Start the environment and open the dev server
```

After that, `npm start` is all you need for day-to-day work. Everything else is in the [script reference](#script-reference) below.

---

## Prerequisites

`npm run setup` checks these for you and prints fix-it instructions, but for reference:

- **Node.js 22 or newer** — check with `node --version`; install from https://nodejs.org (or `brew install node@22` / `nvm install 22`).
- **Node dependencies** — installed with `npm install` from the monorepo root (setup does this).
- **Docker** with Compose v2 (`docker compose version` should work). If you don't have it:
  - macOS: `brew install --cask docker`, then launch Docker Desktop (Compose v2 is bundled). Or download from https://www.docker.com/products/docker-desktop/.
  - Ubuntu/Debian: `curl -fsSL https://get.docker.com | sh`, then `sudo usermod -aG docker $USER` and log out/in so you can run Docker without `sudo`. See https://docs.docker.com/engine/install/ubuntu/ for the manual apt steps.
- **Stack host ports free** — the stack binds five host ports, and `npm start` refuses to launch while any of them is taken (it names the holder and how to free it). Every port is deliberately different from the ones the ROAR platform dev stack uses, so the two environments run in parallel:
  - **5433** — the ephemeral database (the platform Postgres owns 5432). The only overridable port: `ASSESSMENT_PG_PORT=<port> npm start`.
  - **9097 / 9197 / 9002** — the Firebase Auth emulator, Storage emulator, and Emulator UI (the platform stack owns the canonical 9099/9199).
  - **4002** — the backend API (the platform backend owns 4000).
  - Find a holder yourself: `lsof -i :<port>` (macOS) / `ss -tlnp | grep :<port>` (Linux)

---

## First-time setup: `npm run setup`

Run once from the assessment directory, before your first `npm start`:

```bash
cd apps/assessments/roar-swr
npm run setup
```

It walks through five steps and finishes by pointing you at the next command:

1. **Checks the Node.js version** (22+). npm alone only warns and continues on old Node, and the eventual failure looks unrelated.
2. **Checks Docker** (Compose v2, and that the daemon is actually running). If missing or stopped, prints install/launch options and flags it as a blocker — but keeps going, since the remaining steps don't need Docker.
3. **Checks every host port the stack binds is free** — the database port (`ASSESSMENT_PG_PORT`, default 5433), the Firebase emulators (9097/9197/9002), and the backend (4002). Each taken port gets a diagnosis naming the holder and is flagged as a blocker.
4. **Installs dependencies and builds the platform libraries** from the repo root (`api-contract`, `assessment-schema`, `scoring-tables`, `assessment-sdk`). The assessment dev server bundles these from their built output, so they must exist before the first start. This step can take a few minutes.
5. **Creates `taskVariantParameters.json`** from the committed example (never overwrites an existing one — see [Configuring task variants](#configuring-task-variants)).

Any Docker/port blocker is re-printed in a summary at the end so you resolve it before starting. Once setup is happy, run `npm start`.

> Docker and the host ports are **checked but not required** to finish setup — install/build/copy all run regardless, so you can prep the repo now and sort out Docker later.

---

## Starting and stopping

```bash
npm start      # Start the shared stack (if needed) and the assessment dev server
```

**Ctrl+C stops only the assessment dev server.** The Docker services (database, backend, Firebase emulators) keep running in the background and your data is preserved. Run `npm start` again to reattach the dev server to the same database — it detects the running stack and skips straight to the dev server.

```bash
npm stop       # Stop all Docker services — and choose what happens to the database
```

`npm stop` asks one question: **keep the local database (runs, trials, scores, recordings), or delete it?** Keeping is the default — a plain Enter picks it — and stops the containers while the data survives; the next `npm start` brings everything back exactly as you left it. Choosing delete tears down containers **and volumes** for a completely clean slate. Note that uploaded recordings live in the Storage emulator's memory, so they end with the emulator container either way.

`npm restart` is always the clean-slate path: it confirms the wipe once, tears everything down, and starts fresh. Declining is clean — it exits without an error and changes nothing.

For scripting: `npm run stop -- --keep-data` keeps without asking, `npm run stop -- --yes` (or `restart -- --yes`) deletes without asking. Non-interactive shells (CI, pipes) keep the data.

---

## Switching between assessments

The Docker stack — database, backend, and Firebase emulators — is **shared across all assessments** and keeps running in the background; only the dev server on port 8000 is per-assessment. Moving from one assessment to another (say `roar-swr` → `roar-pa`) is:

1. **Stop the current dev server** with Ctrl+C — frees port 8000; the stack and your data stay up.
2. **`cd` to the other assessment** (e.g. `cd ../roar-pa`) and **`npm start`** — it detects the running stack, makes sure this assessment's tasks and variants are seeded (idempotent, a few seconds), and launches its dev server against the same database.

The only first-time prerequisite is the assessment's `taskVariantParameters.json` (`npm run setup`, or `cp taskVariantParameters.example.json taskVariantParameters.json`) — `npm start` names that fix if the file is missing.

A few things follow from the stack being shared and persistent:

- **Every switch path is the same two commands.** Whether the stack kept running (Ctrl+C), was stopped keeping data, or was wiped: `cd` + `npm start` does the right thing — the bring-up path seeds via the migration container, the fast path re-runs the same idempotent seeder from the host. The database survives Ctrl+C and a data-keeping `npm stop`; only `npm restart` (or choosing delete at `npm stop`) wipes it.
- **Runs from both assessments coexist** in the same database — handy for cross-assessment work.
- **No full `npm run setup` needed.** The platform libraries are built once at the repo root and shared, so only the per-assessment `taskVariantParameters.json` (and its seed) is assessment-specific. Running `setup` mid-switch would also spuriously flag the stack's ports as "in use" — that's your own running stack.

---

## Script reference

Run all of these from the assessment's directory. This is the whole surface — the other scripts in `package.json` (`build`, `build:staging`, `dev`, etc.) are for CI and platform developers; ignore them.

| Script               | What it does                                                                                                                                      | When to use                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run setup`      | Check prerequisites, install deps, build platform libraries, create the config file                                                               | Once, on first setup (or on a fresh clone)                                                                                    |
| `npm start`          | Start the shared stack (if not already up), ensure this assessment is seeded, and run its dev server                                              | Every time you sit down to work                                                                                               |
| `npm run seed:tasks` | Seed **new** variants from `taskVariantParameters.json` into the running DB, no teardown (add `-- --refresh-params` to also update existing ones) | After editing `taskVariantParameters.json`, to pick up new or changed variants **without losing your data**                   |
| `npm stop`           | Stop all Docker services; asks whether to keep or delete the database (default: keep)                                                             | Pausing work (keep), or a completely clean slate (delete)                                                                     |
| `npm restart`        | Confirmed full teardown (**deletes data**) and fresh start                                                                                        | When the stack is wedged and `seed:tasks` isn't the issue. **Destroys your data**                                             |
| `npm run update`     | Rebuild the host platform libraries (api-contract / SDK / schema / scoring-tables)                                                                | After `git pull` brings changes to those packages (see [Updating after a pull](#updating-after-a-pull))                       |
| `npm run rebuild`    | Rebuild the Docker images (cached) and apply them to a running stack                                                                              | After changes to the backend, migrations, Dockerfile, or shared deps (see [Rebuilding images](#rebuilding-the-docker-images)) |

---

## What it starts

| Process                                         | URL                   |
| ----------------------------------------------- | --------------------- |
| Firebase emulator — Auth                        | http://localhost:9097 |
| Firebase emulator — Storage (recording uploads) | http://localhost:9197 |
| Firebase emulator — UI (browse recordings)      | http://localhost:9002 |
| ROAR backend (HTTP)                             | http://localhost:4002 |
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

When the stack first comes up, a one-shot migration container runs the database migrations and then seeds this assessment's task(s) and variants. It's driven by the assessment's directory name — `roar-swr` → the `roar-swr` seed config — so **an unregistered assessment fails the migration container** rather than the dev server, naming the tasks it knows about.

Each assessment has a seed config in `apps/backend/seeds/configs/<name>.config.ts` that defines:

- the **task(s)** the variants belong to (single-task assessments have one; multi-task assessments route each variant to a task from its params), and
- a **validation function**.

**Validation runs at seed time.** Seeding fails with a descriptive error if `taskVariantParameters.json` is missing or a variant has an invalid value — the rules come from that config, not from a generic schema.

**Parameter keys are not restricted.** Any key you put in `taskVariantParameters.json` is seeded through to the variant as-is, so you can test a new parameter without touching the backend or rebuilding anything. The trade-off is that a misspelled key won't be flagged — it seeds successfully, the task never reads it, and the assessment silently runs with that parameter at its default. If a parameter seems to have no effect, check its spelling against `taskVariantParameters.example.json` first.

Variants are seeded as `published` and matched by name, so seeding is **idempotent and additive**: a variant that already exists is skipped, and a new entry is added alongside the existing ones. To target a specific variant when playing the assessment, pass `variantId=<id>` in the dev server URL — or use the [variant picker](./ASSESSMENT_RESEARCH_GUIDE.md#switching-variants-the-variant-picker). With no `variantId`, the assessment loads its declared default — see [Choosing which variant loads by default](#choosing-which-variant-loads-by-default).

### Choosing which variant loads by default

Opening the dev server without a `variantId` in the URL used to run whichever variant happened to be seeded first. Each assessment now declares a **preferred default variant per task, by name**, in its `serve/serve.js`:

<!-- This snippet mirrors serve.js verbatim, including its quote style. -->
<!-- prettier-ignore -->
```javascript
// apps/assessments/roar-swr/serve/serve.js — one entry per language task
const DEFAULT_VARIANT_NAMES = {
  [SWR_LANGUAGES.en.taskId]: 'English-v7',
  [SWR_LANGUAGES.es.taskId]: 'Spanish-v1',
  // …it, pt, de
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

Here's the catch: the seed only runs automatically **once**, inside that migration container at bring-up. Editing `taskVariantParameters.json` afterward and running `npm start` again does **nothing** — when the stack is already up, `npm start` skips straight to the dev server and never re-runs the seed. And `npm restart` (or a data-deleting `npm stop`) re-seeds only because it wipes the database volume first, taking every run/trial/score you've generated with it.

Use **`npm run seed:tasks`** instead. It runs the same idempotent, additive-by-name seeder against the **live** database, so newly added variants appear immediately while your generated data stays put:

```bash
# 1. Edit taskVariantParameters.json — add a new entry
# 2. Seed it into the running environment (no teardown, no data loss)
npm run seed:tasks
# 3. Reload the assessment (or use the variant picker) to see the new variant
```

It requires the environment to be running (`npm start` first) — it seeds into the live container database. This is the recommended way to iterate on variants.

**Changing a parameter on an _existing_ variant** needs one extra flag: a plain `npm run seed:tasks` matches variants by name and skips ones that already exist, so an edited value would silently not apply. Re-apply the file's parameters to existing variants with:

```bash
npm run seed:tasks -- --refresh-params
```

Your generated runs/trials/scores still stay put — only the variant parameters are updated.

---

## Updating after a pull

After `git pull` brings in new code, which command you need depends on what changed:

- **Platform libraries the dev server bundles** (`api-contract`, `assessment-sdk`, `assessment-schema`, `scoring-tables`): run **`npm run update`** to rebuild them on the host, then restart the dev server (Ctrl+C, `npm start`).
- **Backend, migrations, the Dockerfile, or root dependencies**: these run inside the Docker images, so run **`npm run rebuild`** (see below).
- **`api-contract` and `assessment-schema`** are used by _both_ the host dev server and the backend, so a change there needs **both** `update` and `rebuild`.

When in doubt after a large pull, `npm run rebuild` then `npm run update` is the safe combination.

---

## Rebuilding the Docker images

`npm start` never rebuilds images once they exist, so changes to files copied into an image need an explicit rebuild:

```bash
npm run rebuild
```

The build is cached — routine post-pull rebuilds take seconds. For the rare case where a cached layer itself is stale, force a clean build with `npm run rebuild -- --no-cache`.

Run this after changing any of the following:

- `assessment.Dockerfile`
- `apps/backend/` — source, migrations, seeds, or dependencies
- `packages/api-contract/` — shared API types and Zod schemas
- `packages/assessment-schema/` — shared assessment data schemas
- Root `package.json` / `package-lock.json` — dependency changes

The environment doesn't need to be stopped first: when the stack is running, `rebuild` finishes by applying the new images itself (only services whose image changed are recreated; the database survives, while the emulator's in-memory auth users and recordings reset). With the stack down, the next `npm start` uses the new images.

---

## Running alongside the platform dev environment

The assessment environment and the ROAR platform dev stack bind disjoint host ports, so they run in parallel — no need to stop one to use the other. Engineers who want to serve an assessment against the **platform** stack (host-run backend on 4000, canonical emulator on 9099) instead of this environment opt in explicitly:

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev
```

The preflight detects the common mistakes (missing opt-in, missing `FIREBASE_AUTH_EMULATOR_HOST` in `apps/backend/.env`) and prints the fix.

---

## Troubleshooting

**"Port 5433 is already in use."** Something is holding the ephemeral database's host port — the error names the holder. Stop it, or run with a different port: `ASSESSMENT_PG_PORT=<port> npm start`.

**"Port 9097 / 9197 / 9002 / 4002 is already in use."** Another program on your machine is holding a Firebase emulator, Emulator UI, or backend port. These ports aren't overridable: stop the holder (the error names it), then `npm start`. The ROAR platform dev stack is never the culprit — the two environments use disjoint ports and run in parallel.

**"Port 8000 is already in use."** A previous dev server (or another assessment) is still running. Stop that process, then `npm start`.

**"taskVariantParameters.json not found."** You skipped the config step. Run `npm run setup`, or copy the example manually (see [Configuring task variants](#configuring-task-variants)).

**The migration container failed with an invalid parameter value.** `npm start` prints the seed container's own error, which names the offending `taskVariantParameters.json` entry. Fix the file, then run `npm start` again — the file is read from your directory at seed time, so no rebuild is needed.

**The migration container failed with "Unknown task."** The assessment isn't registered in the backend's seed config registry — the error names the tasks it knows about. Registering it is a platform-developer change (a seed config in `apps/backend/seeds/configs/`), followed by `npm run rebuild` and `npm start`.

**"My new variant didn't show up."** Editing `taskVariantParameters.json` doesn't re-seed on its own. Run `npm run seed:tasks` (preserves your data) rather than `npm restart` (wipes it). See [Adding or changing variants without losing data](#adding-or-changing-variants-without-losing-data).

**Want a clean slate but keep your seeded variants?** Truncate the run tables (`TRUNCATE app.runs CASCADE` in `roar_assessment`) instead of `npm restart` — it clears your generated runs/trials/scores in one step without re-seeding. See the Research Guide's [Resetting your generated data](./ASSESSMENT_RESEARCH_GUIDE.md#resetting-your-generated-data).

**Seeding printed "Launch sandbox administration not found."** Benign, and expected in this environment. Four assessments (`roar-pa`, `roar-swr`, `roar-sre`, `roar-letter`) declare a `defaultVariant` in their seed config, which the seeder tries to assign to the dashboard's dev launch-sandbox administration. That fixture isn't seeded here, so the assignment is skipped and the message says so — the message even names this stack as the expected case. Your variants are still seeded and playable.

**Seeding warned that a `defaultVariant` "is not in the parameters file."** Also benign for standalone play. It means your `taskVariantParameters.json` no longer contains the variant the seed config names, so the launch-sandbox assignment was skipped. It does not affect which variant `localhost:8000` loads — see [Choosing which variant loads by default](#choosing-which-variant-loads-by-default).

**A code change isn't taking effect.** Host library change → `npm run update`; backend/migration/Dockerfile change → `npm run rebuild`. See [Updating after a pull](#updating-after-a-pull).

**"Failed to bind host port 9002/9097/9197" — or the Firebase emulator container never starts.** Another program already holds those ports (a hand-started `firebase emulators:start`, or an unrelated service). Stop it, then `npm start`. One wrinkle if the first attempt already created the container: starting it again can leave it running with no published ports (`docker port firebase-emulator` prints nothing, and the emulator is unreachable from the host even though the container reports healthy). Recreate it rather than restarting it — `docker compose -f docker-compose.assessment.yml up -d --force-recreate firebase-emulator`.

**Stale containers / name or port conflicts on start.** `npm start` force-removes known stale containers before bringing the stack up, but if it's still wedged, `npm stop` (deletes data) then `npm start` gives a clean slate.

**`docker stop` fails with "permission denied" (Linux/AppArmor).** `npm stop` falls back to direct process kills and, if those are blocked too, prints the exact `sudo kill` command to run. Run it, then re-run `npm stop`.

---

## Connection reference

| Setting             | Value                         |
| ------------------- | ----------------------------- |
| Host                | `localhost`                   |
| Port                | `5433` (`ASSESSMENT_PG_PORT`) |
| Username            | `postgres`                    |
| Password            | `postgres`                    |
| Core database       | `roar_core`                   |
| Assessment database | `roar_assessment`             |
| SSL mode            | `disable`                     |

For clients, queries, and the metadata fields, continue to the **[Research Guide](./ASSESSMENT_RESEARCH_GUIDE.md)**.
