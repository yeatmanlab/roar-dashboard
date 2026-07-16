---
title: Assessment Integration Pattern
description: How an assessment is structured in the monorepo — the dual build (rollup library for the dashboard, webpack/vite standalone for Firebase Hosting), the shared harness helpers, the schema namespace every assessment gets, declarative seeding, and the complete set of files outside the assessment directory that must be touched for it to count as integrated.
impact: HIGH
scope: all
tags: assessments, monorepo, build, integration, workspaces
---

## Assessment integration pattern

> [!TIP]
> This rule describes what an integrated assessment **looks like**. For the step-by-step procedure to get one there — migrating an existing repo or scaffolding a new one — see [.ai/assessment-migration.md](../assessment-migration.md).

> [!NOTE]
> **Last verified 2026-07-16 against `99e8384d0` (project/backend-refactor)**, except where noted below. This rule makes concrete claims about a repo that changes weekly, so treat it as a map, not the territory: **where this rule and the repo disagree, the repo wins.** Re-derive the integration surface with the `git grep` in that section rather than trusting the table — that table has been wrong before, from a `grep -r` that picked up a generated file.
>
> Written deliberately ahead of three changes expected to land alongside it, none of which were in that commit: declarative seed configs ([#1890](https://github.com/yeatmanlab/roar-dashboard/pull/1890)), the npm publishing manifest fields ([#2023](https://github.com/yeatmanlab/roar-dashboard/pull/2023)), and the last four `.json` scoring configs converting to `.ts`. If you're reading this after they merged, the note has served its purpose — delete this paragraph.

Assessments live at `apps/assessments/<name>/` and are npm workspaces (`apps/assessments/*` is in the root `workspaces` array), built and orchestrated by Turbo. The package name is always `@roar-platform/<directory-name>` — the directory name is load-bearing: the seed registry, CI matrices, hosting targets, and the `ASSESSMENT_NAME` derived by `scripts/assessment-env-up.sh` all key off it.

### Every assessment is two artifacts from one directory

This is the fact every other convention follows from. The same source tree produces a **library** consumed by the dashboard and a **standalone site** served by Firebase Hosting. They have different entry points, different bundlers, and different externals.

| Artifact   | Script                               | Bundler + entry                                        | Output                           | Consumer                         |
| ---------- | ------------------------------------ | ------------------------------------------------------ | -------------------------------- | -------------------------------- |
| Library    | `build`                              | `rollup -c rollup.lib.config.mjs`, `src/**/index.js`   | `dist/index.js` (ES + sourcemap) | Dashboard, via workspace symlink |
| Standalone | `build:staging` / `build:production` | `webpack --env dbmode=…` (or `vite`), `serve/serve.js` | Full site in `dist/`             | Firebase Hosting                 |
| Dev server | `dev` / `start`                      | webpack-dev-server (or vite) on `:8000`                | —                                | Local browser                    |

The **library** build externalizes what the host already provides — the SDK, the schema package, and Sentry — and bundles everything else so the package is self-contained:

```javascript
external: [
  /^@roar-platform\/assessment-sdk(\/.*)?$/,
  /^@roar-platform\/assessment-schema(\/.*)?$/,
  /^@sentry\//,
],
```

The **standalone** build injects two globals via webpack's `DefinePlugin`, which `serve.js` and the shared helpers read:

- `ROAR_API_BASE_URL` — defaults to `/v1`, which the dev server proxies to `BACKEND_URL` (`http://localhost:4000`). In staging/production it is the real API origin.
- `ROAR_DB` — `development` | `staging` | `production`. Guards dev-only affordances such as the variant picker, and the guard is eliminated at build time in production.

Both globals must be declared readonly in `eslint.config.mjs`, or lint fails on undefined globals.

### The shared harness workspace

`apps/assessments/shared/` (`@roar-platform/assessment-shared`) is **source-only — it has no build step**, because consuming assessments import it directly and bundle it themselves. Import it by **relative path**, not by package name:

```javascript
import { getFirebaseConfig } from "../../shared/firebaseConfig";
import { mountVariantPicker } from "../../shared/variantPicker.js";
```

It provides `getFirebaseConfig()` (emulator config when `FIREBASE_AUTH_EMULATOR_HOST` is set, otherwise Firebase Hosting's `/__/firebase/init.json`), `mountVariantPicker()`, `initSentry()`, and the `firebase.json` / `storage.rules` the emulator container mounts. Anything genuinely common to every standalone harness belongs here rather than copied into each assessment.

### The serve.js contract

`serve/serve.js` is the standalone harness. Every assessment's version is the same sequence, and `TaskX.vue` in the dashboard is that same sequence with a real user and a real `administrationId` instead of an anonymous session:

1. Read URL params (task, `variantId`, participant, demographics).
2. `getFirebaseConfig()` → `initializeApp` → `getAuth`; `connectAuthEmulator` when `FIREBASE_AUTH_EMULATOR_HOST` is set.
3. `signInAnonymously`, then inside `onAuthStateChanged`:
4. `bootstrapAnonymousSession({ baseUrl, auth }, { variantId?, taskId })` → `{ participantId, variantId }`.
5. `initFirekitCompat(ctx, { variantId, taskVersion, isAnonymous: true })`.
6. `mountVariantPicker(...)` when `ROAR_DB !== 'production'`.
7. `getVariantById(resolvedVariantId)` → `{ variantParams }`.
8. `new TaskLauncher({ ...variantParams }, userParams, null).run()`.

The variant is the source of truth for game parameters. URL params are the fallback for standalone play, not the authority — `roar-multichoice/serve/serve.js` comments this explicitly.

### The package manifest

Beyond the standard fields, an assessment's `package.json` carries three things the platform reads:

```jsonc
{
  "name": "@roar-platform/roar-multichoice",
  "version": "2.3.1",
  // Required for npm provenance on publish — note the `directory` field.
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yeatmanlab/roar-dashboard.git",
    "directory": "apps/assessments/roar-multichoice",
  },
  // Firebase Hosting site names, read by the deploy workflow.
  "roar": {
    "hosting": {
      "staging": "roar-multichoice-monorepo-abc",
      "production": "roar-multichoice-monorepo",
    },
  },
  // Only the library build ships to npm — never the standalone site.
  "files": ["dist/index.js", "dist/index.js.map", "package.json"],
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org",
  },
}
```

`@roar-platform/scoring-tables` is **private and never published**, so when an assessment bundles it, it belongs in `devDependencies` — a published package cannot declare a runtime dependency the registry can't resolve. `assessment-sdk` and `assessment-schema` are real `dependencies` (they do publish), and `@sentry/*` are `peerDependencies`.

### Every assessment gets a schema namespace

`packages/assessment-schema/src/<name>/` is where the platform's shared facts about an assessment live — the things the backend seed, the dashboard, and the assessment itself must all agree on. **Write one for every assessment**, even a minimal one. Hardcoding a task ID in three places and hoping they stay equal is the failure this package exists to prevent.

The minimum is three files, and it is genuinely small — `roav-ran` and `roar-readaloud` are both at this tier:

| File          | Holds                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `config.ts`   | Canonical task IDs, and URL builders for any external asset (GCS stimuli buckets, lookup-table CSVs, config corpora) |
| `variants.ts` | Task entries — `name`, `nameSimple`, `nameTechnical` — consumed by the seed config                                   |
| `index.ts`    | Re-exports                                                                                                           |

```typescript
// config.ts — the task ID is the DB `tasks.slug`, so it must satisfy the check
// constraint `^[a-z0-9]+(-[a-z0-9]+)*$`. Kebab in the DB, camel in the assessment's
// own taskConfig lookup: camelize('symbol-search') === 'symbolSearch'.
export const SYMBOL_SEARCH_TASK_ID = "symbol-search" as const;
export type SymbolSearchTaskId = typeof SYMBOL_SEARCH_TASK_ID;

// Asset URLs belong here, not inlined in the assessment — the dashboard's CSP
// allowlist and the assessment's fetches have to name the same bucket.
export const ROAV_APPS_BUCKET_NAME = "roav-mp" as const;
export const ROAV_APPS_BUCKET_URL =
  `https://storage.googleapis.com/${ROAV_APPS_BUCKET_NAME}` as const;
```

**If the assessment produces scores, the namespace owns their vocabulary** — `domains.ts` (canonical `run_scores.domain` strings), `score-names.ts`, and `score-entries.ts` plus its test. This is true no matter _who_ computes them. The backend's scoring configs are consumers of that vocabulary, not a substitute for it: every config in `services/scoring/configs/` imports its task IDs and score names from here — none of them name anything itself — so a rename in the schema is a compile error in the backend rather than a silently mis-keyed score. `phonics.ts` says so in as many words. That's also why those configs are TypeScript and not JSON: a JSON config has no imports, so it could only ever hardcode.

```typescript
// apps/backend/src/services/scoring/configs/swr.ts — the backend names nothing itself.
import {
  SWR_SCORE_NAMES,
  SWR_TASK_IDS,
  SWR_SCORING_VERSION,
} from "@roar-platform/assessment-schema/roar-swr";
```

Skip the scoring tier only when there are **no computed scores at all** — `roar-survey` (surveys don't score) and `roav-ran` (trial-based, autoscored offline, no scoring config exists) are the real cases. `roar-readaloud` looks like a third but isn't: phonics is a task _within_ ROAR-Letter, so its config imports `roar-letter`'s vocabulary. That's the vocabulary living in the right namespace, not an absent one. "The backend scores it" is **not** a reason to skip — that's the case where the shared vocabulary is doing its job.

### Seeding is declarative

An assessment does not write a seed script. It contributes a `TaskSeedConfig` — task metadata, optional parameter validation, and (for multi-task assessments) a `resolveTaskId` router — and the generic runner in `seeds/task-seed.ts` does the work:

```typescript
export const multichoiceConfig: TaskSeedConfig = {
  tasks: {
    [MORPHOLOGY_TASK_ID]: {
      name: "Morphology",
      nameSimple: "Morphology",
      nameTechnical: "…",
    },
    [CVA_TASK_ID]: {
      name: "Written Vocabulary",
      nameSimple: "CVA",
      nameTechnical: "…",
    },
  },
  validateVariant(loc, params) {
    /* throw on invalid params */
  },
  /** Multi-task only: routes each variant to a task from its params. */
  resolveTaskId(params) {
    /* … */
  },
};
```

Single-task assessments omit `resolveTaskId` entirely. The routing param differs by assessment and reflects a real design split: some are **language-as-task** (`roar-swr`, `roar-sre`, `roar-letter`, `roav-ran` — `lng` selects a language-suffixed slug like `swr-es`), others are **language-as-param** (`roam-apps` — `taskName` selects the task, language is just a parameter). Pick the one the assessment's scoring configs already key off, or the slugs won't resolve.

### The integration surface

An assessment is not integrated when its directory exists. It is integrated when every file below names it. To see the current surface, grep an existing one:

```bash
git grep -l roav-ran -- . ':!apps/assessments/roav-ran' ':!package-lock.json'
```

That grep is the checklist's source of truth, and it's how you verify you missed nothing. Use **`git grep`**, not `grep -r`: it searches tracked files only, so generated artifacts can't masquerade as source. `apps/dashboard/firebase/admin/firebase.json` is the trap — it's gitignored and built by `vite.config.js` from `firebase.template.json` + `csp.template.json`, but it lists every asset bucket, so a working-tree grep reports it and invites a hand-edit the next build silently discards.

| Area      | File                                                                    | What to add                                                                                                               |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Schema    | `packages/assessment-schema/src/<name>/`                                | Always: `config.ts`, `variants.ts`, `index.ts`. If it produces scores: `domains.ts`, `score-names.ts`, `score-entries.ts` |
| Schema    | `packages/assessment-schema/package.json`                               | `exports` subpath `./<name>`                                                                                              |
| Schema    | `packages/assessment-schema/src/index.ts`                               | `export * as <alias> from './<name>/index.js'`                                                                            |
| Backend   | `apps/backend/seeds/configs/<name>.config.ts`                           | Declarative `TaskSeedConfig`                                                                                              |
| Backend   | `apps/backend/seeds/task-seed-configs.ts`                               | Register in `TASK_SEED_CONFIGS` under the directory name                                                                  |
| Backend   | `src/services/scoring/configs/<slug>.ts` + `scoring.config-registry.ts` | If it produces scores — importing slugs and score names from the schema, never retyping them                              |
| Dashboard | `src/components/tasks/TaskX.vue`                                        | Launch component                                                                                                          |
| Dashboard | `package.json`                                                          | Dep pinned to the **exact** workspace version                                                                             |
| Dashboard | `vite.config.js`                                                        | `manualChunks` entry                                                                                                      |
| Dashboard | `firebase/admin/csp.template.json`                                      | Allowlist the GCS asset bucket in **both `img-src` and `media-src`**                                                      |
| Repo      | `.github/CODEOWNERS`                                                    | Per-assessment block — lands with the code in Phase 1, not with CI                                                        |
| CI        | `.github/actions/detect-assessment-changes/action.yml`                  | Paths filter **and** the hardcoded fallback matrix — two edits in one file                                                |
| CI        | `.github/workflows/deploy-assessments-production.yml`                   | Fallback matrix                                                                                                           |
| CI        | `.github/workflows/release.yml`                                         | `PUBLISHABLE_WORKSPACES`                                                                                                  |
| Release   | `.release-please.json` + `.release-please-manifest.json`                | Package block and version                                                                                                 |

The duplicated matrices are what gets missed. `detect-assessment-changes` lists assessments **twice** — once as a `dorny/paths-filter` filter, once as a hardcoded JSON array used when a shared dependency changes — and `deploy-assessments-production.yml` carries a third copy. Miss the fallback arrays and the assessment deploys on its own changes but silently stops deploying when `packages/assessment-sdk` or `apps/assessments/shared/` changes: exactly the case where a redeploy matters most.

`roam-apps` is the current worked example of _migrated but not integrated_. It landed the code and stopped there: the directory exists, it's symlinked at `@roar-platform/roam-apps`, and it has a CODEOWNERS block — the Phase 1 set, exactly. Everything downstream is still missing. It has no schema namespace and no seed config; the dashboard still imports `@bdelab/roam-apps` from the registry (reading its version out of `package-lock.json`, the legacy pattern); and it's absent from `detect-assessment-changes`, the production deploy matrix, `PUBLISHABLE_WORKSPACES`, and both release-please files. A directory under `apps/assessments/` proves only that Phase 1 happened.

### Local development

`npm start` in the assessment directory runs `scripts/assessment-env-up.sh`, which brings up the shared Docker stack (Postgres, migrations + seed, Firebase Auth/Storage emulators, backend) and then the assessment's dev server on `:8000`. The stack is shared across all assessments; only the dev server differs. `ASSESSMENT_NAME` is derived from the calling directory and drives `dev:seed:tasks -- --task ${ASSESSMENT_NAME}`, so **an unregistered assessment fails the migration container, not the dev server** — the error surfaces as a compose failure before anything starts, naming the available tasks.

Each assessment reads `taskVariantParameters.json` to seed its variants. That file is **gitignored**; `taskVariantParameters.example.json` is committed and documents every parameter with its valid values. See [ASSESSMENT_ENVIRONMENT.md](../../apps/assessments/ASSESSMENT_ENVIRONMENT.md) for the full environment guide.

### Incorrect

```javascript
// Importing the shared harness by package name — it has no build step and no
// exports map, so this resolves to nothing the bundler can use.
import { getFirebaseConfig } from "@roar-platform/assessment-shared/firebaseConfig";

// Hardcoding the API origin — breaks the dev-server proxy and the staging build,
// both of which depend on the DefinePlugin global.
const baseUrl = "http://localhost:4000";

// Bundling the SDK into the library build. The dashboard already has it; two
// copies mean two module instances and a broken compat singleton.
export default defineConfig({
  input: "src/experiment/index.js",
  external: [], // SDK and schema now inlined into dist/index.js
});

// Trusting the URL param over the variant. The variant is the source of truth;
// this silently ignores what was seeded.
const roarApp = new RoarMultichoice(
  { task: urlParams.get("task") },
  userParams,
  null,
);
```

```jsonc
// apps/dashboard/package.json — version drifted from the workspace's package.json.
// npm resolves this from the registry instead of symlinking the workspace, so the
// dashboard silently builds against a stale published version. No error, no warning.
"@roar-platform/roar-multichoice": "^2.0.0"
```

```typescript
// A scoring config that retypes the vocabulary the schema already owns —
// roar-multichoice exports CVA_TASK_ID and these score names. Nothing checks these
// strings still agree with it, so a rename in the schema produces a silently
// mis-keyed score instead of a build error. (Configs are .ts rather than .json for
// precisely this reason: JSON has no imports, so it could only ever hardcode.)
export default {
  taskSlugs: ["cva"],
  scoreFields: {
    percentile: [{ minVersion: 1, fieldName: "percentile" }],
  },
} as const;
```

### Correct

```javascript
// Relative import — the shared source is bundled by this assessment's own build.
import { getFirebaseConfig } from "../../shared/firebaseConfig";
import { mountVariantPicker } from "../../shared/variantPicker.js";

// The build injects the origin; '/v1' is proxied to the backend in dev.
const baseUrl = ROAR_API_BASE_URL;

// Variant params are authoritative; the URL param is only a standalone fallback
// for variants that predate the field.
const { variantParams } = await getVariantById(resolvedVariantId);
const roarApp = new RoarMultichoice(
  { task, ...variantParams },
  userParams,
  null,
);

// Dev/staging affordance; the guard is eliminated at build time in production.
if (ROAR_DB !== "production") {
  mountVariantPicker({
    baseUrl,
    auth: authCallbacks,
    taskId,
    currentVariantId: resolvedVariantId,
  });
}
```

```jsonc
// apps/dashboard/package.json — exact match with the workspace version, so npm
// symlinks apps/assessments/roar-multichoice rather than fetching from the registry.
"@roar-platform/roar-multichoice": "2.3.1"
```

```typescript
// configs/cva.ts, abridged — the config imports the vocabulary instead of retyping it,
// so renaming a score name in the schema fails the backend build rather than silently
// producing a mis-keyed score. `minVersion: 0` is the bare-literal floor entry (there is
// no V0 constant), and versioned arrays must be in strictly descending minVersion order.
import {
  CVA_TASK_ID,
  MULTICHOICE_SCORING_VERSION,
  MULTICHOICE_COMPOSITE_SCORE_NAMES,
  MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES,
} from "@roar-platform/assessment-schema/roar-multichoice";

export default {
  taskSlugs: [CVA_TASK_ID],
  scoreFields: {
    percentile: [
      {
        minVersion: MULTICHOICE_SCORING_VERSION.V1,
        fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.PERCENTILE,
      },
      { minVersion: 0, fieldName: null },
    ],
    rawScore: [
      {
        minVersion: MULTICHOICE_SCORING_VERSION.V1,
        fieldName: MULTICHOICE_COMPOSITE_SCORE_NAMES.TOTAL_CORRECT,
      },
      {
        minVersion: 0,
        fieldName: MULTICHOICE_NON_ADAPTIVE_SCORE_NAMES.SUB_SCORE,
      },
    ],
  },
  classification: { type: "none" as const },
} as const;
```

### The principle

The dual build is the whole design. The dashboard needs a library that trusts its host for auth, SDK, and Sentry; researchers and reviewers need a standalone site that provisions its own anonymous session. Serving both from one source tree is what keeps the two paths from drifting — but it only works if the externals, the injected globals, and the `serve.js` contract are respected, because each is a place where the two builds could quietly diverge. The integration surface is long and mostly mechanical, and that is exactly why it's written down: the failures it produces are silent ones — a stale registry build, an assessment that stops redeploying when the SDK changes — not loud ones.
