# @roar-platform/assessment-schema

Shared facts about ROAR assessments that the backend, the dashboard, and every assessment must
agree on. Hardcoding a task ID in three places and hoping they stay equal is the failure this
package exists to prevent.

## What belongs here, and what doesn't

The package holds three kinds of content. They look similar but answer different questions, and
conflating them is what made the dependency-declaration question in
[#2168](https://github.com/yeatmanlab/roar-project-management/issues/2168) hard to answer.

| Category              | Must a consumer be able to change it?                    | Where it lives                                   |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| **Vocabulary**        | **No** — their data would stop correlating with ours     | Stays here, unconditionally                      |
| **Reference data**    | Not the data; possibly the **origin** it is fetched from | Stays here, origin overridable                   |
| **Deployment config** | **Yes, necessarily**                                     | Origin constants only; the rest is host-supplied |

### Vocabulary — the reason this package exists

Task IDs (`tasks.slug` in the database), scoring versions, score names, score domains, subscore
and CAT names, trial types, variant metadata, and the shared enums (`ScoreType`,
`AssessmentStage`). Everything in `domains.ts`, `score-names.ts`, `score-entries.ts`,
`variants.ts`, `subscores.ts`, `trial-types.ts`, `constants/`, `enums/`, and `types/`, plus the
`*_TASK_ID(S)` and `*_SCORING_VERSION` exports in each `config.ts`.

These are strings three independent parties compare. A consumer that redefined them would write
data that no longer joins against ours, which is the opposite of what this package is for.

### Reference data — the norms are the science

The IRT parameters (`SRE_COMPOSITE_FOUNDATIONAL_IRT_PARAMS`) and the normed lookup tables the
`*_SCORE_TABLE_URL` builders point at. A consumer wants _our_ norms — those are research
output, not configuration — but may need to serve the CSVs from their own mirror.

So the data stays authoritative here, and every locator takes an optional `origin`:

```ts
PA_SCORE_TABLE_URL(PA_SCORING_VERSION.V5_ADAPTIVE);
// -> https://storage.googleapis.com/roar-pa/scores/pa_lookup_v5.csv

PA_SCORE_TABLE_URL(PA_SCORING_VERSION.V5_ADAPTIVE, 'https://assets.example.org');
// -> https://assets.example.org/roar-pa/scores/pa_lookup_v5.csv
```

Bucket and filename structure is preserved, so a mirror only has to copy the tree.

### Deployment config — what a host must be able to replace

ROAR's asset origins, collected in [`src/constants/asset-origins.ts`](src/constants/asset-origins.ts):
`GCS_ORIGIN` for the score tables, the ROAV stimuli bucket, and the ReadAloud corpora; and
`READALOUD_DEVICE_CONFIG_ORIGIN` for the device-calibration profiles, which are on Azure Blob
Storage rather than GCS and so must stay independently overridable.

Every builder that consumes them accepts an override parameter defaulting to the constant. There
is deliberately **no** `setOrigin()` or other module-level mutable configuration — see below.

## Two invariants

**No module-level mutable state.** This package is pure constants and pure functions. That is
what makes it safe for consumers to bundle and duplicate: two copies behave identically, so a
nested second copy is harmless. A mutable configuration default would let two copies diverge in
behaviour, reintroducing the hazard that purity avoids. Overrides are therefore per-call
arguments, never global setters.

**No ROAR infrastructure identifiers.** GCP project IDs and Firebase project names do not belong
here — a published package should not name our infrastructure. The one exception is
[`src/firebase-emulator.ts`](src/firebase-emulator.ts), whose docblock explains why: those
identifiers exist so the backend's Firebase Admin init and the assessments' client init agree on
the same _local_ emulator project. That is cross-party agreement, i.e. vocabulary, and the values
are conventional emulator placeholders rather than real ROAR infrastructure.

## Layout

```
src/
  constants/          asset-origins, common domains, theta and trial-count score names
  enums/              ScoreType, AssessmentStage
  types/              ScoreEntry
  firebase-emulator.ts
  score-utils.ts
  <assessment>/
    config.ts         task IDs, scoring versions, score-table locators
    domains.ts        canonical run_scores.domain values
    score-names.ts    canonical score names
    score-entries.ts  computed-scores -> ScoreEntry[] adapters
    variants.ts       variant metadata consumed by the backend seed
    index.ts
```

Not every assessment has every file: those that produce no computed scores (`roar-survey`,
`roav-ran`) have no scoring vocabulary, and `roar-readaloud`'s phonics scores live under
`roar-letter` because phonics is a task within ROAR-Letter.

## Related

- [`.ai/rules/assessment-integration-pattern.md`](../../.ai/rules/assessment-integration-pattern.md) — what an integrated assessment looks like, including this package's role
- [#2016](https://github.com/yeatmanlab/roar-project-management/issues/2016) — per-assessment SDK bundling; this package is bundled per assessment, which is why purity matters
- [#2171](https://github.com/yeatmanlab/roar-project-management/issues/2171) — version-parity test, which guards content agreement now that npm cannot
