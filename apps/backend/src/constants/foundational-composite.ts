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
 * wrong value here silently produces incorrect student-facing composites.
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
