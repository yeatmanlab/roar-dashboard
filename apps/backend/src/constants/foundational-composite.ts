/**
 * Foundational composite constants
 *
 * The foundational composite combines a student's Letter, Phoneme (PA), and Word (SWR)
 * theta estimates into an inverse-variance weighted "LPW" composite, then optionally
 * blends in the Sentence (SRE) transformed score. These constants centralize the task
 * slugs the composite is built from and the Stage-2 blend weights / Sentence floor so the
 * scoring math has a single source of truth.
 *
 * @see services/foundational-composite/foundational-composite.service.ts
 */
import type { KeyingStrategy } from '@roar-platform/scoring-tables';
import { SCORE_NAME } from './run-scores';

/**
 * Task slugs that participate in the foundational composite.
 *
 * Slugs are the canonical `tasks.slug` values (verified against
 * `packages/assessment-schema`): PA = `pa`, Word/SWR = `swr`, Letter = `letter`,
 * Sentence/SRE = `sre`. Scoped to the English foundational set; language variants
 * (e.g. `swr-es`) use different norming and are out of scope.
 */
export const FOUNDATIONAL_COMPOSITE_SLUG = {
  PA: 'pa',
  SWR: 'swr',
  LETTER: 'letter',
  SRE: 'sre',
} as const;

export type FoundationalCompositeSlug = (typeof FOUNDATIONAL_COMPOSITE_SLUG)[keyof typeof FOUNDATIONAL_COMPOSITE_SLUG];

/**
 * The three subtests that contribute a `composite_foundational` theta pair
 * (`thetaEstimate`, `thetaSE`) to the LPW composite.
 */
export const LPW_SLUGS: readonly FoundationalCompositeSlug[] = [
  FOUNDATIONAL_COMPOSITE_SLUG.PA,
  FOUNDATIONAL_COMPOSITE_SLUG.SWR,
  FOUNDATIONAL_COMPOSITE_SLUG.LETTER,
];

/**
 * All foundational slugs — a trial write on a run for any of these triggers a composite
 * recompute.
 */
export const FOUNDATIONAL_COMPOSITE_SLUGS: readonly FoundationalCompositeSlug[] = [
  ...LPW_SLUGS,
  FOUNDATIONAL_COMPOSITE_SLUG.SRE,
];

/**
 * Stage-2 blend weights for the final composite:
 *   final = LPW_COMPOSITE_WEIGHT * LPW + SRE_TRANSFORMED_WEIGHT * sreTransformed
 * Applied only when both an LPW composite and a Sentence score are available and the
 * Sentence score is at or above {@link SRE_TRANSFORMED_FLOOR}.
 *
 * PROVENANCE: these weights and the floor below come from the product/scoring spec and are
 * PENDING CONFIRMATION against the norming source. Verify them before production rollout — a
 * wrong value here silently produces incorrect student-facing composites. The normed-scoring
 * inputs below carry the same caveat: confirm the lookup-table URL/bucket
 * (`FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL`) and {@link FOUNDATIONAL_COMPOSITE_KEYING} before
 * enabling {@link FOUNDATIONAL_COMPOSITE_NORMING_ENABLED}.
 */
export const LPW_COMPOSITE_WEIGHT = 0.514;
export const SRE_TRANSFORMED_WEIGHT = 0.486;

/**
 * Sentence floor. When a student took both LPW subtests and Sentence, the Sentence score
 * is blended in only if `sreTransformed >= SRE_TRANSFORMED_FLOOR`; below the floor the
 * final composite falls back to the LPW composite alone. The floor does not gate the
 * only-Sentence case. PENDING CONFIRMATION (see the weights note above).
 */
export const SRE_TRANSFORMED_FLOOR = -3.03;

// --- Normed scoring (lookup table) ---

/**
 * Feature gate for converting the composite theta into normed scores (percentile, standard
 * score, …) via the lookup table.
 *
 * Default `false`: the composite lookup table is not published yet (the URL in
 * `@roar-platform/assessment-schema` `FOUNDATIONAL_COMPOSITE_SCORE_TABLE_URL` is a placeholder)
 * and the keying/demographic decisions below are pending scoring-team confirmation. While
 * disabled, the composite writes only its `thetaEstimate`. Flip to `true` once the table is
 * published and {@link FOUNDATIONAL_COMPOSITE_KEYING} + the demographic source are confirmed.
 */
export const FOUNDATIONAL_COMPOSITE_NORMING_ENABLED: boolean = false;

/**
 * How the composite norm table is keyed. Shared, configurable description consumed by the
 * backend norming via `@roar-platform/scoring-tables` `resolveNormedScores`.
 *
 * Default: key on clamped age-in-months (deriving age from grade via the shared 66 + grade*12
 * heuristic when age is unknown) and match `thetaEstimate` on the 0.1 grid. This mirrors
 * SWR/Letter/Multichoice, and the composite is reported on SWR's (foundational) IRT scale, so
 * the age clamp defaults to SWR's [72, 216] months. Switch `keyKind`/`clamp`/`matchMode` here
 * (no code change) once the scoring team finalizes the composite norming contract.
 */
export const FOUNDATIONAL_COMPOSITE_KEYING: KeyingStrategy = {
  keyKind: 'ageMonths',
  keyColumn: 'ageMonths',
  clamp: { min: 72, max: 216 },
  scoreColumn: SCORE_NAME.THETA_ESTIMATE,
  matchMode: 'theta',
};

/**
 * The normed columns persisted from a matched lookup row, mapped to the `run_scores.name`
 * they are written under (`type = computed`, `domain = composite_foundational`). Columns the
 * table doesn't provide are simply skipped. Lookup-table column name -> score name.
 */
export const FOUNDATIONAL_COMPOSITE_NORM_SCORE_NAMES = {
  percentile: SCORE_NAME.PERCENTILE,
  standardScore: SCORE_NAME.STANDARD_SCORE,
  roarScore: SCORE_NAME.ROAR_SCORE,
} as const;

/**
 * Minimum scoring versions required for each subtest to be included in the foundational composite.
 * Subtests below these versions are skipped during composite calculation.
 */
export const FOUNDATIONAL_COMPOSITE_MIN_VERSIONS: Record<FoundationalCompositeSlug, number> = {
  [FOUNDATIONAL_COMPOSITE_SLUG.SWR]: 7,
  [FOUNDATIONAL_COMPOSITE_SLUG.SRE]: 5,
  [FOUNDATIONAL_COMPOSITE_SLUG.PA]: 5,
  [FOUNDATIONAL_COMPOSITE_SLUG.LETTER]: 1,
} as const;
