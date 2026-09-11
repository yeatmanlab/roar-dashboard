/**
 * Canonical run_scores.domain strings for non-composite SRE subtasks.
 * These are the static block/corpus identifiers produced by getBlockOrder in config.js.
 * Dynamic fixed-form domains ('fixedForm1', 'fixedForm2', …) are covered by SreSubtaskDomain
 * via a template literal type and are not enumerated here.
 */
export const SRE_SUBTASK_DOMAINS = {
  LAB: 'lab',
  AI: 'ai',
  AI_V1_P1: 'aiV1P1',
  AI_V1_P2: 'aiV1P2',
  AI_V2: 'aiV2',
  TEST1: 'test1',
  TEST2: 'test2',
} as const;

export type SreSubtaskDomain = (typeof SRE_SUBTASK_DOMAINS)[keyof typeof SRE_SUBTASK_DOMAINS] | `fixedForm${number}`;
