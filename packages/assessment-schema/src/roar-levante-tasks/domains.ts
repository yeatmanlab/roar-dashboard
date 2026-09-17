import { COMPOSITE_DOMAIN } from '../constants/common-domains.js';

/**
 * Canonical run_scores.domain strings for all LEVANTE task score entries.
 * Both normed tasks (trog, roar-inference) and unnormed tasks write scores
 * to the composite domain.
 */
export const LEVANTE_SCORE_DOMAINS = {
  COMPOSITE: COMPOSITE_DOMAIN,
} as const;
