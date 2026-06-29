import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';

/**
 * Canonical run_scores.domain strings for LEVANTE normed task score entries.
 * Trog and roar-inference produce a single composite domain.
 */
export const LEVANTE_SCORE_DOMAINS = {
  COMPOSITE: COMPOSITE_DOMAIN,
} as const;
