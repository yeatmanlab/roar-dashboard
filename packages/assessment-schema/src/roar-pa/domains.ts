import { COMPOSITE_DOMAIN, COMPOSITE_FOUNDATIONAL_DOMAIN } from '../constants/common-domains.js';

/**
 * Canonical run_scores.domain strings for PA score entries.
 * Casing for these strings is deliberately distinct from the subtask keys ('fsm', 'lsm', 'del')
 */
export const PA_SCORE_DOMAINS = {
  FSM: 'FSM',
  LSM: 'LSM',
  DEL: 'DEL',
  COMPOSITE: COMPOSITE_DOMAIN,
  COMPOSITE_FOUNDATIONAL: COMPOSITE_FOUNDATIONAL_DOMAIN,
} as const;

export type PaScoreDomain = (typeof PA_SCORE_DOMAINS)[keyof typeof PA_SCORE_DOMAINS];
