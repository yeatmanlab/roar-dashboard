import { PA_SCORE_NAMES } from "./score-names.js";
import type { PaSubtaskKey } from "./config.js";
import type { PaScoreName } from "./score-names.js";

export const PA_SUBTASK_LABELS = {
  FSM: "First Sound",
  LSM: "Last Sound",
  DEL: "Deletion",
} as const satisfies Record<PaSubtaskKey, string>;

export type PaSubtaskLabel =
  (typeof PA_SUBTASK_LABELS)[keyof typeof PA_SUBTASK_LABELS];

export interface PaSubscoreDef {
  /** Human-readable label for the subscore column header. */
  label: PaSubtaskLabel;
  correctName: PaScoreName;
  attemptedName: PaScoreName;
  percentCorrectName: PaScoreName;
}

/**
 * Per-subtask display metadata and run_scores.name mappings for PA.
 * Consumers iterate PA_SUBTASK_KEYS to preserve canonical order.
 *
 * Note: attemptedName fields ARE emitted as subtask score entries whenever the
 * scores.js callback provides a non-null numAttempted for that subtask
 * (see toPaScoreEntries). They are skipped only when numAttempted is null/undefined.
 */
export const PA_SUBSCORE_DEFS = {
  FSM: {
    label: PA_SUBTASK_LABELS.FSM,
    correctName: PA_SCORE_NAMES.FSM_CORRECT,
    attemptedName: PA_SCORE_NAMES.FSM_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.FSM_PERCENT_CORRECT,
  },
  LSM: {
    label: PA_SUBTASK_LABELS.LSM,
    correctName: PA_SCORE_NAMES.LSM_CORRECT,
    attemptedName: PA_SCORE_NAMES.LSM_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.LSM_PERCENT_CORRECT,
  },
  DEL: {
    label: PA_SUBTASK_LABELS.DEL,
    correctName: PA_SCORE_NAMES.DEL_CORRECT,
    attemptedName: PA_SCORE_NAMES.DEL_ATTEMPTED,
    percentCorrectName: PA_SCORE_NAMES.DEL_PERCENT_CORRECT,
  },
} as const satisfies Record<PaSubtaskKey, PaSubscoreDef>;
