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
  percentCorrectName: PaScoreName;
}

/**
 * Per-subtask display metadata and run_scores.name mappings for PA.
 * Consumers iterate PA_SUBTASK_KEYS to preserve canonical order.
 *
 * Note: #Attempted names are not emitted by scores.js callback (which only tracks
 * numCorrect and percentCorrect per subtask). They were previously included for UI
 * display but are no longer needed.
 */
export const PA_SUBSCORE_DEFS = {
  FSM: {
    label: PA_SUBTASK_LABELS.FSM,
    correctName: PA_SCORE_NAMES.FSM_CORRECT,
    percentCorrectName: PA_SCORE_NAMES.FSM_PERCENT_CORRECT,
  },
  LSM: {
    label: PA_SUBTASK_LABELS.LSM,
    correctName: PA_SCORE_NAMES.LSM_CORRECT,
    percentCorrectName: PA_SCORE_NAMES.LSM_PERCENT_CORRECT,
  },
  DEL: {
    label: PA_SUBTASK_LABELS.DEL,
    correctName: PA_SCORE_NAMES.DEL_CORRECT,
    percentCorrectName: PA_SCORE_NAMES.DEL_PERCENT_CORRECT,
  },
} as const satisfies Record<PaSubtaskKey, PaSubscoreDef>;
