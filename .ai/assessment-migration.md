# Integrating an assessment into the monorepo

This is the procedure for bringing an assessment into `apps/assessments/` — either **migrating** an existing standalone repo (still on `@bdelab/roar-firekit`, still deploying itself) or **scaffolding** a new one. For what the finished result should look like, read [assessment-integration-pattern](rules/assessment-integration-pattern.md) first; this document assumes it.

Both paths converge after Phase 1. Migration is the longer road, so it's the one written out in full — greenfield differences are called out inline.

> [!NOTE]
> **Last verified 2026-07-16 against `99e8384d0` (project/backend-refactor)**, except where noted below. Commands, file paths, and phase contents here were checked against the repo at that commit, but it moves weekly: **where this document and the repo disagree, the repo wins.** Re-derive rather than trust — and prefer `git grep` over `grep -r`, which reports generated artifacts as though they were source.
>
> Written deliberately ahead of three changes expected to land alongside it, none of which were in that commit: declarative seed configs ([#1890](https://github.com/yeatmanlab/roar-dashboard/pull/1890) — Phase 2 assumes `seeds/configs/<name>.config.ts` and `dev:seed:tasks`, replacing the per-assessment `seeds/<name>.seed.ts`), the npm publishing manifest fields ([#2023](https://github.com/yeatmanlab/roar-dashboard/pull/2023) — the `repository` field and `scoring-tables` placement in Phase 1's `package.json`), and the last four `.json` scoring configs converting to `.ts`. If you're reading this after they merged, the note has served its purpose — delete this paragraph.

## Phase 0 — Plan before you branch

**Write a migration plan first.** Every assessment migrated so far has had one, and they earn their keep: each surfaced at least one thing that would have been discovered painfully mid-PR. Answer these before writing code:

| Question                                                                    | Why it changes the work                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| How many tasks does the bundle serve, and what routes between them?         | Determines `resolveTaskId` and whether slugs are language-suffixed                                 |
| Does it capture audio/video?                                                | Pulls in `uploadFile` / `flushUploads` and Storage emulator wiring                                 |
| Is it scored client-side, backend-side, or both?                            | Decides whether you need a schema namespace and/or a scoring config                                |
| Does it have tasks that should ship but not launch?                         | Bundle-only tasks (e.g. roam's `response-modality-study`) are excluded from seed/dashboard/scoring |
| Which locales are wired vs. merely present?                                 | Migrate all source; wire only supported locales                                                    |
| Does its build do anything unusual (WASM, ONNX, CSV corpora, eye-tracking)? | These are the genuine long poles — find them now                                                   |

**Then chain the PRs.** Branch off `project/backend-refactor`, one concern per PR, each targeting the previous, merged bottom-up, draft by default:

```
project/backend-refactor                    branches under ref/1844/<ticket>/
  └─ migrate-<name>                         Phase 1 — land the code
       └─ seed-schema-<name>                Phase 2 — schema and seed
            └─ sdk-wiring-<name>            Phase 3 — SDK integration
                 └─ dashboard-<name>        Phase 4 — dashboard integration
                      └─ deployment-versioning-<name>
                                            Phase 5 — CI, deployment, e2e, release
```

The order is a dependency chain, not a preference. Each phase is verifiable only because the one before it landed:

| Phase               | Verifiable because                                       | Would be untestable if you skipped ahead  |
| ------------------- | -------------------------------------------------------- | ----------------------------------------- |
| 2 — schema and seed | The seed can run against a DB on its own                 | —                                         |
| 3 — SDK integration | Phase 2 seeded variants for `serve.js` to resolve        | No variant to launch; nothing to prove    |
| 4 — dashboard       | Phase 3 proved the run/trial/score path works standalone | A dashboard failure could be either layer |
| 5 — CI and release  | Phases 1–4 made the thing actually work                  | You'd be deploying something unproven     |

Phase 3 before 4 is the one that earns its keep: `serve.js` and `TaskX.vue` are the same sequence, so proving it standalone first means a dashboard bug in Phase 4 is a dashboard bug — not an ambiguity between two unproven layers.

**Real migrations varied, and that's fine.** The recent ones converged on roughly this shape — `roav-apps` and `roav-ran` both ran `migrate → seed-schema → sdk-wiring → dashboard-deployment-versioning`, combining 4 and 5; `roar-levante-tasks` split those two apart exactly as above. The early ones (`roar-swr`, `roar-multichoice`) used just `migrate → configure`, which is why their PRs were large. Five is the default to reason from, not a quota:

- **Collapsing 4 and 5** is the most common and most defensible merge — it's what the roav migrations did.
- **Adding a phase** is right for genuinely novel work: readaloud added one for the upload seam, levante two for scoring.
- **Don't collapse 1 into anything.** Phase 1 is reviewable as "is this the same code, minus secrets?" and that property is worth protecting on its own.

## Phase 1 — Land the code

### 1a. Existing repo: subtree import

```bash
git subtree add --prefix=apps/assessments/<name> \
  https://github.com/yeatmanlab/<name>.git main --squash
```

Then **delete secrets** — do this before anything else, and verify with the scan below:

| File                           | Why                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `serve/firebaseConfig.js`      | Firebase API keys and project IDs — replaced by `../../shared/firebaseConfig` |
| `.firebaserc`                  | Firebase project aliases                                                      |
| `.firebase/`                   | Hosting cache                                                                 |
| `cypress/support/devFirebase*` | Dev credentials, if present                                                   |

**Delete what the monorepo now owns:**

| File                              | Replaced by                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `.github/`                        | Root workflows; CI is driven from the outer repo                     |
| `.eslintrc.json` / `.prettierrc*` | `eslint.config.mjs` / `prettier.config.mjs`                          |
| `.nvmrc`                          | Root `.nvmrc`                                                        |
| `package-lock.json`               | Root lockfile                                                        |
| `rollup.config.js`                | `rollup.lib.config.mjs`                                              |
| `postBuildPackage.js`             | Fixed `dist/index.js` output makes hashed-entry patching unnecessary |

**Keep** `LICENSE`, `firebase.json`, `cypress.config.js`, `webpack.config.cjs`, and any data files the source imports (CSV corpora, IRT hyperparameters). A deleted corpus fails at runtime, not build time.

### 1b. Greenfield: scaffold instead

Copy the tooling from the closest existing assessment — `roar-multichoice` for a single jsPsych bundle, `roar-levante-tasks` or `roam-apps` for a multi-task battery, `roar-survey` for a Vue/vite app. Skip the subtree and secret-deletion steps entirely; everything below applies unchanged.

### 1c. Both paths: the tooling five

Create these, mirroring an existing assessment:

1. **`package.json`** — rewrite. `name` → `@roar-platform/<dir>`; keep the upstream `version`; fixed `main`/`module`/`exports`/`files` → `./dist/index.js`; add `repository` (with `directory`), `publishConfig`, and `roar.hosting`. Use the standard script set. **Remove every lifecycle hook** (`prepublishOnly`, `pre/postversion`, `prepackage`) — release-please and the release workflow own that now.
2. **`rollup.lib.config.mjs`** — library build; externalize the SDK, schema, and `@sentry/*`.
3. **`turbo.json`** — `extends: ["//"]`, declare `build.outputs` and any env vars. Turbo runs `envMode: strict`, so an env var not declared in `env` or `passThroughEnv` **is not visible to the build** and fails silently rather than loudly.
4. **`eslint.config.mjs`** — extend `@roar-platform/eslint-config`; declare `ROAR_DB` and `ROAR_API_BASE_URL` as readonly globals.
5. **`prettier.config.mjs`** + `.prettierignore`.

### 1d. Security scan and ownership

```bash
grep -rn "AIza\|private_key\|service_account\|BEGIN RSA" apps/assessments/<name>/
find apps/assessments/<name> -name ".env" -not -name ".env.example"
ls apps/assessments/<name>/serve/firebaseConfig.js   # must not exist
ls apps/assessments/<name>/.github                   # must not exist
```

A Sentry DSN is a public ingest key — safe to commit. Add a `CODEOWNERS` block naming the assessment's author team.

**Phase 1 is done when** `npm run build -w apps/assessments/<name>` produces `dist/index.js`, `npm install` resolves from the root, and the scan is clean. The assessment does **not** run end-to-end yet. That's expected.

## Phase 2 — Schema and seed

Everything here is platform-side and testable without touching the assessment's source. Landing it first gives Phase 3 something to launch against.

### 2a. Write the schema namespace

**Every assessment gets one — this isn't a decision.** Write `packages/assessment-schema/src/<name>/` with at least `config.ts` (canonical task IDs, asset/bucket URL builders), `variants.ts` (task metadata for the seed), and `index.ts`. Then add the `exports` subpath in the package's `package.json` and the `export * as <alias>` re-export in `src/index.ts`. See [the rule](rules/assessment-integration-pattern.md#every-assessment-gets-a-schema-namespace) for the file tiers.

Task IDs are DB slugs, so they must satisfy `^[a-z0-9]+(-[a-z0-9]+)*$`. Get them right here first — the seed config, the scoring config, and the dashboard all key off them.

**If the assessment produces scores, add the scoring tier** — `domains.ts`, `score-names.ts`, `score-entries.ts` + test — regardless of whether the assessment or the backend computes them. The namespace owns the vocabulary; the backend's scoring config imports it. Skip it only when there are no computed scores at all (`roar-survey`, `roav-ran`), or when the vocabulary genuinely belongs to another assessment's namespace (`roar-readaloud`'s phonics scoring imports `roar-letter`, because phonics is a task within ROAR-Letter). "The backend handles scoring" is not a reason to skip.

Then write the backend scoring config at `src/services/scoring/configs/<slug>.ts` and register it in `scoring.config-registry.ts`. Scoring configs are TypeScript — never JSON — for exactly one reason: **they import their task IDs and score names from the schema instead of retyping them.** A rename in the schema then fails the backend build rather than silently producing a mis-keyed score that nobody notices until a report looks wrong. JSON has no imports, so a JSON config could only ever hardcode.

```typescript
// configs/swr.ts, abridged — the backend names nothing itself.
import {
  SWR_SCORE_NAMES,
  SWR_TASK_IDS,
  SWR_SCORING_VERSION,
} from "@roar-platform/assessment-schema/roar-swr";

export default {
  taskSlugs: [SWR_TASK_IDS.EN],
  scoreFields: {
    percentile: [
      {
        minVersion: SWR_SCORING_VERSION.V7,
        fieldName: SWR_SCORE_NAMES.PERCENTILE,
      },
      { minVersion: 0, fieldName: SWR_SCORE_NAMES.WJ_PERCENTILE },
    ],
    // …standardScore, rawScore, etc.
  },
  classification: {
    type: "percentile-then-rawscore" as const /* …cutoffs, thresholds */,
  },
} as const;
```

Two conventions worth copying rather than rediscovering: `minVersion: 0` is the bare-literal floor entry (there's no `V0` constant), and versioned arrays must be in **strictly descending** `minVersion` order — the Zod schema rejects ascending ones, because `resolveVersionedEntry` would otherwise always match the lowest entry and silently ignore newer ones.

The slug must match the slug the seed creates, or `getScoringConfig(slug)` returns undefined and scores silently never compute — which is why deriving both from the same constant matters.

One config file per slug, even when two are near-identical: `swr-it.ts` and `swr-pt.ts` differ only in a comment and a slug, and `cva.ts`/`morphology.ts` only in the slug. They stay separate so either can diverge without disturbing the other. A single config may legitimately serve several slugs when they're genuinely one task family — `fluency.ts` covers the ARF and CALF tasks across locales — but reach for that only when the slugs share one scoring definition by nature, not because two files happen to look alike today.

Scoring is a correctness boundary: verify the score report renders against real data rather than reasoning from a plan. The roam-apps plan argued for no schema namespace at all on the grounds that the backend scores from raw trials — implementation added one anyway.

### 2b. Seed config and example parameters

Add `apps/backend/seeds/configs/<name>.config.ts` and register it in `TASK_SEED_CONFIGS` under the directory name. Then write `taskVariantParameters.example.json` — a JSON array of `{ variantName, params }`, where `params` keys mirror the `gameParams` the assessment's `serve.js` passes to the task runner. Derive the entries from real production variants where you can; document every parameter with its valid values, because this file is how the next person learns the parameter surface.

That example file is **not just documentation** — CI copies it to `taskVariantParameters.json` to seed the stack for the assessment's e2e run (Phase 5). An invalid or unrepresentative example breaks CI later, at a distance from the change that caused it.

**Phase 2 is done when** the seed creates every expected slug idempotently, and each resolves via `getScoringConfig(slug)` if the assessment is scored.

The practical way to run it is to bring the stack up — `cp taskVariantParameters.example.json taskVariantParameters.json` then `npm start -w apps/assessments/<name>`. The compose migration container runs `dev:seed:tasks --task <name>` for you and supplies the `CORE_DATABASE_URL` and `TASK_VARIANT_PARAMETERS_FILE` the seed requires (it throws without them, so a bare `npm run dev:seed:tasks` outside the container won't get far). Restart the stack to prove idempotency: the second run should skip everything it already created rather than duplicate or fail. Then query the seeded rows — see [ASSESSMENT_ENVIRONMENT.md](../apps/assessments/ASSESSMENT_ENVIRONMENT.md).

You're verifying against the database, not the assessment. The dev server will come up and the assessment still won't work — it's on firekit until Phase 3. That's expected.

## Phase 3 — SDK integration

Now the assessment's own source changes. Phase 2 seeded the variants this phase resolves against, so by the end of it the assessment genuinely runs.

### 3a. firekit → assessment-sdk

Remove `@bdelab/roar-firekit` entirely — even for bundle-only tasks, or the build won't resolve. Import from `@roar-platform/assessment-sdk/compat/firekit`.

| Legacy call                                      | Replacement                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `firekit.startRun()`                             | `startRun(metadata?)`                                                                        |
| `firekit.writeTrial(data, cb)`                   | `writeTrial(data, cb)`                                                                       |
| `firekit.finishRun()`                            | `finishRun(metadata?)`                                                                       |
| `firekit.addInteraction(data)`                   | `addInteraction(data)`                                                                       |
| `firekit.updateEngagementFlags(flags, reliable)` | `updateEngagementFlags(flags, reliable)`                                                     |
| `firekit.updateUser({...})`                      | **Drop the call.** Assessments never write user data — see below.                            |
| `firekit.updateTaskParams(params)`               | **Drop the call** + `console.warn`. No SDK equivalent — the backend owns variant params now. |
| `this.firekit.run.completed` poll                | Poll a **local** completion flag instead; add `abort()` → `abortRun()`. See below.           |
| `uploadFileOrBlobToStorage(...)`                 | `uploadFile(...)`, plus `flushUploads()` before finishing                                    |

The `TaskLauncher` constructor loses its `firekit` parameter: `new TaskLauncher(variantParams, userParams, target)`.

**Completion polling has no SDK equivalent** — there is no run object to read. `isTaskFinished` is an assessment-local helper (`src/tasks/shared/helpers/isTaskFinished`), not an SDK export; roam-apps, roav-apps, and levante each carry their own copy. Point it at a flag the assessment owns: levante polls its Pinia store (`await isTaskFinished(() => taskStore().taskComplete)`). If the assessment you're migrating has no such helper, copy one — don't reach for the SDK.

**Assessments read identity; they never write it.** Every legacy `updateUser` call is dropped, not replaced. Identity is owned upstream, and the assessments migrated so far have run without it — dropping it is settled, not provisional. The SDK's `updateUser` export exists only as a firekit-compatibility stub and throws if called; treat it as absent. If a migration plan shows `updateUser → updateUser`, the plan predates this decision.

Where the assessment has an **editable** participant-ID field (roav-ran and roav-apps do; readaloud's is pre-filled and disabled), the operator-entered PID goes into run metadata via `startRun` and/or the recording's `uploadFile` `customMetadata`. Never onto the user record, and never overwriting a PID the user already has.

**`assessment_stage` renames.** `'practice_response'` → `'practice'`, `'test_response'` → `'test'`. The SDK's `writeTrial` accepts all four, so this is cleanup — but any _other_ stage value throws on the `validStages` check. Watch for stages invented by the assessment: roam's `break_response` on a persisted break trial is the known case, and it needs remapping to the phase the break sits in. Check the filler `correct: 1` on such trials doesn't inflate the raw score through `_accumulateRawScore`.

### 3b. Rewrite serve.js

Follow the [serve.js contract](rules/assessment-integration-pattern.md#the-servejs-contract). Preserve the assessment's existing URL params for demographics — reviewers rely on them.

**Phase 3 is done when** `grep -rn "roar-firekit\|firekit\." apps/assessments/<name>/src` is empty and you have **played every task through `serve.js` against the local stack** (`npm start -w apps/assessments/<name>`), confirming runs, trials, and scores persist. Types passing is not evidence here. This is the phase that proves the assessment works at all — everything after it is integration.

## Phase 4 — Dashboard integration

Rewrite `TaskX.vue` mirroring the closest existing component. It is the same sequence Phase 3 just proved, with a real user instead of an anonymous one: resolve the participant via `GET /me`, resolve the administration and variant, `initFirekitCompat` with `taskVersion` imported from the package's own `package.json`, then `getVariantById` → `new TaskLauncher(...)`.

The rest is the dashboard rows of the [integration surface table](rules/assessment-integration-pattern.md#the-integration-surface): the dep pinned to the exact workspace version, the `vite.config.js` chunk, and the CSP bucket allowlist. Add the assessment's GCS bucket to **both the `img-src` and `media-src` arrays** in `firebase/admin/csp.template.json` — that template is the source file. `firebase/admin/firebase.json` sits next to it and lists the same buckets, but it's a build artifact: `vite.config.js` generates it by merging `firebase.template.json` with the CSP template, it's gitignored, and hand-edits are overwritten by the next build. Miss the CSP entry and the assessment's stimuli are blocked in the deployed dashboard while working perfectly in local dev.

**Phase 4 is done when** the task launches from the dashboard against the local stack and score reports render. Because Phase 3 proved the standalone path, anything failing here is a dashboard problem — that narrowing is the whole reason for the split.

## Phase 5 — CI, deployment, e2e, release

Nothing here changes how the assessment behaves; it changes whether the platform knows about it. Work the CI and release rows of the [integration surface table](rules/assessment-integration-pattern.md#the-integration-surface): both `detect-assessment-changes` lists, the production deploy matrix, `PUBLISHABLE_WORKSPACES`, and both release-please files. CODEOWNERS is not among them — it lands back in Phase 1, so ownership is right from the first commit rather than five PRs later. For release mechanics and the publishing dry-run gate, see [.github/RELEASING.md](../.github/RELEASING.md).

**e2e needs no wiring — it follows from the matrix.** Once the assessment is in `detect-assessment-changes`, `ci.yml` runs its Cypress specs per changed assessment: it copies `taskVariantParameters.example.json`, brings up `docker-compose.assessment.yml` with `ASSESSMENT_NAME`, starts `npm run dev:ci` on `:8000`, and runs `cypress/e2e/**/*`. Three consequences worth knowing:

- **Specs are optional.** The job explicitly checks for specs first and skips with a notice when there are none — `cypress-io/github-action` exits 1 on "no spec files found", so the guard exists to make specs-less assessments legal. `roar-readaloud`, `roav-apps`, and `roav-ran` all shipped without any.
- **Your example params are now CI infrastructure.** They seed the stack the specs run against. If they're wrong, e2e fails here rather than in Phase 2.
- **Inherited specs rarely survive contact.** Specs that came along in the subtree were written against the old standalone Firebase stack. Re-write them against the local stack or delete them — don't leave them failing.

**External provisioning** is not code and blocks the first deploy — do it out of band: create the Firebase Hosting sites named in `roar.hosting`, and confirm the Sentry project and `SENTRY_AUTH_TOKEN`.

**Phase 5 is done when** a CI run shows the assessment in the detect-changes matrix, its e2e leg either passes or deliberately skips, and the release/publish entries are in place.

## Caveats

**Pin `firebase` to `^10.13.2`.** The SDK's peer range expects it. Version 11.x produces a second Firebase instance, and `getApp()` inside the SDK then resolves the wrong one — uploads fail at runtime with nothing useful in the stack trace.

**Keep vitest on one major across the workspace.** A single package on a different major breaks _other_ packages' tests with an unrelated-looking `tinyrainbow disableDefaultColors` error.

**The dashboard's version pin must match the workspace version exactly.** Drift and npm silently resolves from the registry instead of symlinking — you get a stale published build with no warning. This bites hardest right after release-please bumps a version.

**Sourcemaps in production.** Set `devtool: false` and `deleteSourcemapsAfterUpload: true` on the production Sentry plugin, or sourcemaps ship to the hosting site.

**Plans go stale; the repo doesn't.** The `~/Documents/*-migration-plan.md` docs were written against the base branch as it stood at the time, and several have since been overtaken. Known divergences: roam-apps got the schema namespace its plan rejected; the older plans map `updateUser → updateUser`, which is now dropped outright; and every plan that describes writing a `seeds/<name>.seed.ts` predates the declarative seed configs. Read the plans for the domain reasoning — the task inventory, the scoring analysis, the locale audit, the production variant lists — which is the part that doesn't rot. Re-derive the mechanical steps from the current repo.

## Troubleshooting

**`Unknown task "<name>". Available tasks: …`** — the seed config isn't registered in `TASK_SEED_CONFIGS`. Surfaces as an `assessment-db-migrate` compose failure before the dev server starts.

**`taskVariantParameters.json not found`** — it's gitignored by design. `cp taskVariantParameters.example.json taskVariantParameters.json`.

**Port 5432 or 8000 already in use** — stop your local Postgres (`brew services stop postgresql@<v>` / `sudo systemctl stop postgresql`) or the other assessment dev server. Both are pre-flight-checked with a readable error.

**Changes to the backend, Dockerfile, or shared packages have no effect** — Docker layer caching. `npm run rebuild` (no need to stop the stack first), then `npm start`.

**`docker compose down` fails with permission denied** — AppArmor on some Linux hosts. `npm stop` falls back to killing the container PIDs directly and prints a `sudo kill` command if even that's blocked.

**Lint fails on `ROAR_DB` / `ROAR_API_BASE_URL` undefined** — declare them as readonly globals in `eslint.config.mjs`.

**Score report renders blank but trials persisted** — a slug mismatch between the seed and the scoring config, or a missing client score adapter. Check `getRegisteredSlugs()` against what the seed actually created.

**Assessment stops redeploying when the SDK changes** — you added the paths filter to `detect-assessment-changes` but not the hardcoded fallback matrix. There are three such arrays across two files.

**Uploads throw inside the SDK** — see the `firebase` version pin above.

## Reference implementations

| Shape                                       | Follow                             |
| ------------------------------------------- | ---------------------------------- |
| Single jsPsych bundle, multi-task via param | `roar-multichoice`                 |
| Multi-task battery                          | `roar-levante-tasks`, `roam-apps`  |
| Vue / vite app                              | `roar-survey`                      |
| Audio/video recording + uploads             | `roar-readaloud`                   |
| Language-as-task slugs                      | `roar-swr`, `roar-sre`, `roav-ran` |
