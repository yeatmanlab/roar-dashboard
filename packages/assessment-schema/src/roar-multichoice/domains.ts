import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';

/**
 * Canonical run_scores.domain strings for multichoice (morphology and CVA) score entries.
 * Both task families share the same domain structure — no branching needed.
 *
 * - COMPOSITE: the primary scoring domain, always present
 * - COMPOSITE_COMPREHENSION: comprehension sub-score domain, present for adaptive tasks only
 */
export const MULTICHOICE_SCORE_DOMAINS = {
  COMPOSITE: COMPOSITE_DOMAIN,
  COMPOSITE_COMPREHENSION: 'composite_comprehension',
} as const;

export type MultichoiceScoreDomain = (typeof MULTICHOICE_SCORE_DOMAINS)[keyof typeof MULTICHOICE_SCORE_DOMAINS];
