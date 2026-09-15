import { PA_SCORE_DOMAINS } from './domains.js';
import { PA_SCORE_NAMES } from './score-names.js';
import type { PaSubtaskKey } from './config.js';
import type { PaScoreDomain } from './domains.js';
import type { PaScoreName } from './score-names.js';

export const PA_SUBTASK_LABELS = {
  FSM: 'First Sound',
  LSM: 'Last Sound',
  DEL: 'Deletion',
} as const satisfies Record<PaSubtaskKey, string>;

export type PaSubtaskLabel = (typeof PA_SUBTASK_LABELS)[keyof typeof PA_SUBTASK_LABELS];

export interface PaSubscoreDef {
  /** Human-readable label for the subscore column header. */
  label: PaSubtaskLabel;
  /** Uppercase domain key matching run_scores.domain for this subtask (FSM, LSM, DEL). */
  domain: PaScoreDomain;
  correctName: PaScoreName;
  attemptedName: PaScoreName;
  percentCorrectName: PaScoreName;
}

/**
 * Per-subtask display metadata and run_scores.name mappings for PA.
 * Consumers iterate PA_SUBTASK_KEYS to preserve canonical order.
 *
 * Score names are generic (numCorrect, numAttempted, percentCorrect) because
 * the domain field already distinguishes FSM from LSM from DEL. This matches
 * the BigQuery schema where the same generic names appear under separate domains.
 */
export const PA_SUBSCORE_DEFS = {
  FSM: {
    label: PA_SUBTASK_LABELS.FSM,
    domain: PA_SCORE_DOMAINS.FSM,
    correctName: PA_SCORE_NAMES.NUM_CORRECT,
    attemptedName: PA_SCORE_NAMES.NUM_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.PERCENT_CORRECT,
  },
  LSM: {
    label: PA_SUBTASK_LABELS.LSM,
    domain: PA_SCORE_DOMAINS.LSM,
    correctName: PA_SCORE_NAMES.NUM_CORRECT,
    attemptedName: PA_SCORE_NAMES.NUM_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.PERCENT_CORRECT,
  },
  DEL: {
    label: PA_SUBTASK_LABELS.DEL,
    domain: PA_SCORE_DOMAINS.DEL,
    correctName: PA_SCORE_NAMES.NUM_CORRECT,
    attemptedName: PA_SCORE_NAMES.NUM_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.PERCENT_CORRECT,
  },
} as const satisfies Record<PaSubtaskKey, PaSubscoreDef>;
