# Establishing a Monorepo for ROAR Assessments

Using ROAR Phoneme Assessment (`roar-pa`) as the initial example.

## Summary

This ticket establishes a monorepo pattern for assessments by migrating the ROAR Phoneme assessment into the roar-dashboard as the first example. This creates a template for additional assessments to follow.

## Outcomes

- Make assessment development easier using shared locations and, eventually, shared configurations between apps which abstract common logic
- Provide an interface between the assessments and the backend to report, store, and display scores
- Provide a smoother local development strategy for assessment owners by leveraging the existing backend API infrastructure
- Provide an exemplar for other ROAR assessments to be transitioned into the roar-platform monorepo

## Initial Implementation

The first pass at this will be a brute-force operation to move all ROAR Phoneme files into the `apps/assessments/` directory. Each assessment moved into the roar-platform repository will receive a subdirectory which preserves its local file structure.

> **Directory structure decision:** Assessments live under `apps/assessments/` rather than directly under `apps/`. This keeps platform infrastructure apps (`dashboard`, `backend`, `drizzle`) visually separated from assessment apps, supports a dedicated `apps/assessments/*` workspace glob, and allows Turbo filters to target all assessments at once (e.g. `--filter="./apps/assessments/*"`). As more assessments are migrated this grouping will pay dividends in navigability.

The current development scripts will need to be modified to connect to the local backend, rather than to Firebase as they currently do. Researchers will be able to query their data locally using PgAdmin, pgweb, psql, or other database querying tools.

The `assessment-schema` package will be created to build out the interface between the assessments and the backend.

## Implementation Details

### Phase 1: File Migration

1. Migrate `roar-pa` using `git subtree` (see [File Relocation and Git History](#file-relocation-and-git-history))

### Phase 2: Build & Bundling

1. Add `"apps/assessments/*"` as an additional entry to the `workspaces` array in the root `package.json`, alongside the existing `"apps/*"` and `"packages/*"` entries. The `apps/*` glob only matches direct children of `apps/`, so `apps/assessments/roar-pa` would be invisible to npm and Turbo without this addition.
2. Update `apps/dashboard/package.json` to replace the npm dependency `"@bdelab/roar-pa"` with a workspace reference `"@roar-platform/roar-pa": "*"`.
3. Add build tasks for `roar-pa` to `turbo.json` with proper dependencies on `@api-contract`, `@assessment-sdk`, and `@assessment-schema`.
4. Configure build output in Webpack for monorepo paths. Update the webpack dev server port to read from the `DEV_PORT` constant exported by `@assessment-schema` rather than being hardcoded in the webpack config directly. Because `dev` depends on `^build` in `turbo.json`, `assessment-schema` is always compiled before the dev server starts, so the import is safe.
5. Set up environment-specific `.env` files.
6. Update the root `package.json` `dev` script to exclude assessment apps so that `npm run dev` from the monorepo root does not start all assessment dev servers:
   ```roar/roar-dashboard/monorepo-example.md
   "dev": "turbo run dev --filter=!./apps/assessments/*"
   ```
7. Add a per-assessment convenience script to root `package.json` following the `dev:<name>` pattern:
   ```roar/roar-dashboard/monorepo-example.md
   "dev:pa": "turbo run dev --filter=./apps/assessments/roar-pa"
   ```
   Each subsequent assessment migration adds its own entry here. This is the standard way to start an individual assessment dev server from the monorepo root.

### Phase 3: Dependency & Config Consolidation

1. Deduplicate shared dependencies (Webpack, ESLint, Prettier, Babel, etc.) into root `package.json`; the assessment `package.json` keeps only package-specific dependencies (i18n, jsPsych, etc.).
2. Migrate `roar-pa`'s ESLint config from the legacy `.eslintrc.json` format (currently extending `airbnb-base`) to a flat `eslint.config.mjs` that imports from `@roar-platform/eslint-config`. These formats are incompatible — this is a migration, not just a config swap.
3. Replace the standalone `.prettierrc` with a `prettier.config.mjs` that re-exports from `@roar-platform/prettier-config`.
4. Ensure workspace imports use monorepo packages (`api-contract`, `assessment-sdk`, `assessment-schema`), not npm.

### Phase 4: Assessment-Specific Integration

1. Identify reporting logic that is a candidate for interface abstraction. Known candidates from `roar-pa`:
   - Score kind constants: `'scaled_irt'`, `'raw_total_correct'`
   - Scoring version constants: `3` (non-adaptive), `4` (adaptive)
   - Subtask name constants (short form): `'fsm'`, `'lsm'`, `'del'`, `'composite'`
   - **`run_scores.name` field strings (flat form):** `'fsmCorrect'`, `'fsmAttempted'`, `'fsmPercentCorrect'`, etc. These are distinct from the short subtask names above — they are the literal strings the assessment scoring callback writes to the database and the backend registry reads back. Today this contract is implicit; making it an exported constant in `@assessment-schema` is what closes the drift bug class.
   - **Subscore column metadata:** render order, display labels, and kind discriminator (`'itemLevel' | 'number' | 'stringPassthrough' | 'paSkillsToWorkOn'`) for each column in the PA report. This links assessment field names to report display without the backend hard-coding either.
   - Task ID constants: `'pa'`, `'pa-{language}'`
   - Score lookup table URL pattern
   - Dev server port (consumed by the webpack dev server config at build time)
2. Create constants and/or interfaces for identified reporting logic, export and package them in a barrel index file, and implement in the assessment app code (`@assessment-schema` becomes a dependency of all assessments). The module structure for PA:
   ```
   packages/assessment-schema/src/pa/
   ├── score-names.ts      # PA_SCORE_NAMES (run_scores.name strings, as const)
   ├── subscore-columns.ts # PA_SUBSCORE_COLUMNS (column metadata, as const)
   ├── config.ts           # task IDs, scoring versions, dev port, etc.
   └── index.ts            # barrel re-export
   ```
3. Update `apps/backend/src/services/scoring/subscore-table.registry.ts` to import `PA_SCORE_NAMES` and `PA_SUBSCORE_COLUMNS` from `@assessment-schema` in place of hard-coded strings. The registry assembly logic is otherwise unchanged. Apply the same treatment to the JSON config files alongside it (`configs/pa.json`, etc.) — either replace them with TypeScript modules that import from the schema, or validate them against the schema constants at test time.
4. Replace `roar-firekit` calls with `FirekitFacade` from `@assessment-sdk`. Note: `packages/assessment-sdk/src/compat/firekit.ts` already implements `FirekitFacade` — a Singleton adapter designed as a drop-in replacement for legacy `RoarAppkit` usage. The work here is wiring the `serve/` layer to initialise via `initAssessmentSdk()` and pass a `FirekitFacade` instance in place of `RoarAppkit`, not building the adapter itself.
5. Replace Firebase project instantiation logic (`serve/firebaseConfig.js`) with local backend connection logic pointing to the Express server in `apps/backend`.
6. Create a seed script which imports task and variant data into the local Postgres database (see [Phase 5](#phase-5-researcher-environment-setup)).

### Phase 5: Researcher Environment Setup

> **Design option — Firebase config for local dev:** The current implementation injects all Firebase config values at build time via webpack `DefinePlugin`, sourcing them from environment variables (GitHub secrets in CI, `.env` locally). This means researchers who clone the repo and run an assessment locally must create a `.env` file with the development Firebase API key and related values — a new friction point compared to the original standalone repos, which hardcoded the dev config directly.
>
> A simpler option: hardcode the **development** Firebase config directly in `serve/firebaseConfig.js` (restoring the original pattern for dev only), and continue injecting staging and production configs via `DefinePlugin` from secrets. Staging is not accessible to researchers locally, so it doesn't need to be dev-friendly — only production and staging build artifacts need secrets. This eliminates the `.env` requirement for local dev entirely, with no security trade-off (Firebase web API keys are public by design and restricted via GCP API key domain rules).
>
> Evaluate this approach when implementing Phase 5, since the researcher UX goal is zero-friction local setup.

#### 5a. Add an Ephemeral Postgres Service to `docker-compose.yml`

Implementation notes:

- `researcher-db` uses the official `postgres` image with a named volume (`pgdata`) — data persists across `docker compose up`/`down` cycles but is deleted on `docker compose down -v`.
- Two databases are provisioned on first boot via an init script (`scripts/init-researcher-db.sh`): `roar_core` and `roar_assessment`. This script runs automatically when Postgres first initialises and is a no-op on subsequent starts.
- Port `5432` is exposed so researchers can connect with psql, PgAdmin, pgweb, or any other client.
- A `healthcheck` on `researcher-db` gates all dependent services.
- OpenFGA services are intentionally left unchanged — they continue to reference `host.docker.internal:5432` (the platform developer's local Postgres). Researchers do not interact with OpenFGA; they only need the `researcher-db` and `researcher-db-migrate` services.

#### 5b. Add a Migration + Seed Init Service

A single one-shot `researcher-db-migrate` service in `docker-compose.yml` handles migrations, FDW setup, and seeding in sequence:

```
npm ci --ignore-scripts
apt-get install postgresql-client
npm run build -w packages/assessment-schema
./scripts/setup-fdw-local.sh
npm run db:migrate -w apps/backend
npm run db:seed:pa -w apps/backend
```

Implementation notes:

- `npm ci --ignore-scripts` skips native addon compilation (notably `canvas`) which fails on Node 24's ABI.
- `assessment-schema` must be built explicitly because `--ignore-scripts` suppresses lifecycle hooks.
- `setup-fdw-local.sh` runs after the DB is healthy (TCP available) — it cannot run as a Postgres init script because Postgres only listens on a Unix socket during the init phase.
- The service mounts anonymous volumes over `node_modules` and `packages/assessment-schema/dist` so the container never writes to the host filesystem.
- `node:22` is pinned (not `node:lts`) to avoid behaviour changes as LTS advances.

#### 5c. Create a `roar-pa` Seed Script

`apps/backend/scripts/seed-pa.ts` inserts the PA task and its default variants into `roar_core`. It is:

- Idempotent (`ON CONFLICT DO NOTHING`) — safe to run repeatedly
- Referenced via `"db:seed:pa": "tsx scripts/seed-pa.ts"` in `apps/backend/package.json`
- Driven by constants from `@roar-dashboard/assessment-schema/pa` (`PA_TASK_ID`)

The seed runs as the final step of `researcher-db-migrate`, so researchers never need to invoke it manually.

#### 5d. Add `researcher-environment` Scripts to Each Assessment

Scripts live in each assessment's own `package.json`, not at the monorepo root. This keeps the command scoped to the assessment the researcher is working on and makes the dev server per-assessment explicit.

```json
"researcher-environment:up": "docker compose -f ../../../docker-compose.yml up --wait researcher-db researcher-db-migrate && npm run dev",
"researcher-environment:down": "docker compose -f ../../../docker-compose.yml down -v"
```

`--wait` blocks until `researcher-db-migrate` exits successfully (migrations + seed complete) before the dev server starts.

A `researcher-environment:down` convenience alias is also kept at the monorepo root for teardown from any working directory:

```json
"researcher-environment:down": "docker compose down -v"
```

#### Docker installation requirement

Researchers must install Docker Engine via the **official Docker apt repository**, not via snap. The snap-packaged Docker does not set the socket group to `docker`, which requires `sudo` for every Docker command.

Official install: https://docs.docker.com/engine/install/ubuntu/

After installation, a one-time setup step adds the researcher to the `docker` group:

```bash
sudo usermod -aG docker $USER
# Log out and back in for group membership to take effect
```

No `daemon.json` changes are needed when Docker is installed via apt.

#### Researcher setup flow (one-time)

```bash
# 1. Install Docker Engine via apt (not snap) — see above
# 2. Add yourself to the docker group and log out/in
# 3. Clone the repo and install dependencies
npm install                        # from repo root

# 4. Start the environment from your assessment directory
cd apps/assessments/roar-pa
npm run researcher-environment:up  # starts DB + migrations + seed + dev server

# 5. Tear down when done
npm run researcher-environment:down
```

### Proposed Directory Structure

```roar/roar-dashboard/monorepo-example.md
.
├── apps/
│   ├── assessments/
│   │   ├── pa/
│   │   │   ├── src/
│   │   │   ├── serve/
│   │   │   └── ...
│   │   └── swr/
│   │       ├── src/
│   │       ├── serve/
│   │       └── ...
│   ├── backend/
│   ├── dashboard/
│   └── drizzle/
├── packages/
│   ├── assessment-sdk/
│   ├── assessment-schema/
│   │   └── src/
│   │       ├── pa/
│   │       │   ├── score-names.ts
│   │       │   ├── config.ts
│   │       │   └── index.ts
│   │       ├── swr/
│   │       │   ├── score-names.ts
│   │       │   ├── config.ts
│   │       │   └── index.ts
│   │       └── index.ts
│   ├── api-contract/
│   └── ...
├── scripts/
│   └── seed-roar-pa.ts
├── package.json
├── turbo.json
└── README.md
```

## Migration Strategy

The initial migration creates the template for additional assessments to be migrated.

### File Relocation and Git History

Migrate `roar-pa` into the monorepo using `git subtree` to preserve full commit history while keeping a clean monorepo log.

1. **Migrate `roar-pa` files using Git subtree.**

   The `--squash` flag collapses the entire `roar-pa` commit history into a single commit in the monorepo. This keeps the monorepo log clean while still making the full `roar-pa` history available via `git subtree` commands.

   ```roar/roar-dashboard/monorepo-example.md
   git subtree add --prefix apps/assessments/roar-pa https://github.com/yeatmanlab/roar-pa.git main --squash
   ```

2. **Clean up build artifacts and `roar-pa`-specific configs.**

   ```roar/roar-dashboard/monorepo-example.md
   cd apps/assessments/roar-pa
   rm -rf dist/ lib/ node_modules/ package-lock.json .git
   rm -rf .github/ firebase.json .firebaserc
   ```

   > **Flag for future deletion:** `rollup.config.js`, `postBuildPackage.js`, and the `prepackage` / `package` / `postpackage` / `prepublishOnly` scripts belong to the standalone library publishing workflow, which is superseded by Option A (keep internal). Do not remove them in this PR — track removal as follow-up work once the migration is stable.

3. **Update `package.json`.**
   - Change name to `@roar-platform/roar-pa`
   - Remove: `preversion`, `version`, `postversion` scripts
   - Remove: `repository`, `bugs`, `homepage` fields (no longer applicable)
   - Update `main`/`module` to point to monorepo build output

4. **Commit.**

   ```roar/roar-dashboard/monorepo-example.md
   cd ../../..
   git add .
   git commit -m "feat: migrate roar-pa into monorepo - final deprecation of standalone package"
   ```

5. **Deprecate the original `@bdelab/roar-pa` package on npm.**

   ```roar/roar-dashboard/monorepo-example.md
   npm deprecate @bdelab/roar-pa@"*" "Migrated to roar-dashboard monorepo. See: https://github.com/yeatmanlab/roar-dashboard"
   ```

6. **Publishing Decision** (deferred or immediate)
   - **Option A — Recommended for first pass**: Keep `roar-pa` internal; it publishes as part of dashboard builds only
   - **Option B**: Publish `@roar-platform/roar-pa` from the monorepo on each release (requires a versioning strategy)
   - **Option C**: Publish only `@assessment-schema` and `@assessment-sdk`; keep assessments internal

### Workspaces

1. Add `"apps/assessments/*"` to the root `package.json` `workspaces` array (see Phase 2, step 1).
2. Import dependencies (`api-contract`, `assessment-sdk`, `assessment-schema`) from workspace, not npm.
3. Update dev scripts to work relative to the monorepo root.
4. Root `npm run dev` excludes all assessment apps (`--filter=!./apps/assessments/*`). Individual assessments are started via their `dev:<name>` convenience script (e.g. `npm run dev:pa`). The `researcher-environment` script uses `--filter` directly for the same reason.
5. Assign each assessment a fixed port from the assessment port range (8000+). New ports are claimed sequentially as assessments are migrated and recorded in the port registry (see [Port Registry](#port-registry)).

### Port Registry

Each assessment dev server runs on a fixed, dedicated port. The port is declared as a `DEV_PORT` constant in the assessment's `assessment-schema` entry (e.g. `packages/assessment-schema/src/pa/config.ts`) and consumed by the assessment's webpack dev server config at build time. This makes `assessment-schema` the single source of truth for the port — the webpack config is just a consumer.

Ports are assigned sequentially starting from 8000 as assessments are migrated. Dynamic or OS-assigned ports are not used so that conflicts fail fast rather than silently.

When migrating a new assessment, declare its `DEV_PORT` in `assessment-schema`, claim the next available port below, and add a row here.

| Assessment                  | Package                  | Dev Port |
| --------------------------- | ------------------------ | -------- |
| ROAR Phonological Awareness | `@roar-platform/roar-pa` | 8000     |

### Testing & CI/CD

1. Update Cypress config to reference the monorepo root instead of relative paths.
2. Update GitHub Actions workflows to be monorepo-aware.

## Acceptance Criteria

The issue will be considered closed when all of the following requirements are met.

### Developer Criteria

- [ ] Git history is preserved for `roar-pa` (verify with `git log apps/assessments/roar-pa/`)
- [ ] Build step for `roar-pa` executes within the monorepo (`turbo run build` includes `roar-pa`)
- [ ] Project builds into the correct directory (`apps/assessments/roar-pa/dist/`)
- [ ] Cypress tests run against `localhost:8000`
- [ ] Dependencies in the `roar-pa` workspace are deduplicated (no Webpack, Rollup, or ESLint in `roar-pa/package.json`)
- [ ] `roar-pa` workspace uses a flat `eslint.config.mjs` inheriting from `@roar-platform/eslint-config` (legacy `.eslintrc.json` removed)
- [ ] `roar-pa` workspace uses a `prettier.config.mjs` inheriting from `@roar-platform/prettier-config` (legacy `.prettierrc` removed)
- [ ] `npm run dev` from the monorepo root does NOT start assessment dev servers
- [ ] `npm run dev:pa` from the monorepo root starts the `roar-pa` dev server on port 8000
- [ ] `roar-pa` dev port (`8000`) is declared as a constant in `packages/assessment-schema/src/pa/config.ts` and consumed by the webpack dev server config
- [ ] `PA_SCORE_NAMES` in `packages/assessment-schema/src/pa/score-names.ts` covers every `run_scores.name` string the PA scoring callback writes (both subtask field strings like `fsmCorrect` and summary scores like `roarScore`, `percentile`)
- [ ] `PA_SUBSCORE_COLUMNS` in `packages/assessment-schema/src/pa/subscore-columns.ts` produces the same column list — same keys, labels, render order, and kind discriminators — as the PA entry in `apps/backend/src/services/scoring/subscore-table.registry.ts`
- [ ] `apps/backend/src/services/scoring/subscore-table.registry.ts` imports from `@assessment-schema` instead of hard-coding PA score-name strings
- [ ] No backend file outside `@assessment-schema` contains a hard-coded `run_scores.name` string for PA

### Researcher Criteria

- [ ] Original assessment functionality is preserved (all Cypress tests pass)
- [ ] `npm run researcher-environment:up` (run from `apps/assessments/roar-pa/`) starts the ephemeral Postgres, runs migrations and seed, then starts the assessment dev server — no other steps required after first-time Docker setup
- [ ] `npm run researcher-environment:down` tears down all Docker services and removes the Postgres volume
- [ ] Local Postgres database is ephemeral (fully deleted on `researcher-environment:down`)
- [ ] Migrations run automatically on first boot (no manual steps required)
- [ ] Seed script populates the PA task and default variants (`English Fixed`, `English Adaptive`) on first run
- [ ] Seed is idempotent — subsequent `researcher-environment:up` runs do not fail or duplicate data
- [ ] Researchers can query their local data using psql, PgAdmin, pgweb, or equivalent on port 5432
- [ ] Researchers can modify assessment code in `apps/assessments/roar-pa/src/` and open pull requests
- [ ] Docker must be installed via the official apt repository (not snap); documented in Phase 5d

## Out of Scope (Future Work)

- Removing `rollup.config.js` and library packaging scripts from `roar-pa` (flagged, tracked separately)
- Optimizing monorepo build times with caching strategies
- Assessment-specific CI/CD pipelines
- Publishing assessment packages individually to npm
- Migrating other assessments (`roar-swr`, etc.) — this ticket covers `roar-pa` only
- Shared UI component library across assessments

## Known Issues & Risks

- **Risk**: If the `roar-pa` dev build changes its port convention, researchers may need script updates
- **Risk**: Webpack config changes may affect asset loading relative to the monorepo root
- **Issue**: `postversion` script removal may break release automation — defer to a separate PR
- **Debt**: `rollup.config.js`, `postBuildPackage.js`, and the library packaging scripts (`prepackage`, `package`, `postpackage`, `prepublishOnly`) are flagged for deletion in a follow-up PR once the migration is stable
- **Constraint**: `researcher-db-migrate` uses `npm ci --ignore-scripts` to avoid native addon compilation failures (`canvas`, `node-pre-gyp`) on Node 24. This means `assessment-schema` must be built explicitly in the same command. If new workspace packages with lifecycle build scripts are added as dependencies, they must also be built explicitly in the migrate container command.
- **Constraint**: Port `5432` is used by `researcher-db`. Researchers who already have a local Postgres running on `5432` will see a port conflict. They must stop their local Postgres before running `researcher-environment:up`, or change the host port mapping in `docker-compose.yml`.
- **Constraint**: Docker must be installed via the official apt repository. The snap-packaged Docker does not assign the socket to the `docker` group, requiring `sudo` for all Docker commands. This is documented in Phase 5d but must be communicated clearly in researcher onboarding.

## Related Issues

- [Researcher local development strategy](https://github.com/yeatmanlab/roar-project-management/issues/1662)
- [Individual task score reporting](https://github.com/yeatmanlab/roar-project-management/issues/1685)
