/**
 * Canonical task IDs for the ROAR LEVANTE normed tasks.
 * Only trog and roar-inference have backend scoring configurations today.
 * Task IDs for all 12 levante tasks will be added in a follow-on PR once
 * the full assessment-schema migration is complete.
 */
export const LEVANTE_NORMED_TASK_IDS = {
  TROG: 'trog',
  ROAR_INFERENCE: 'roar-inference',
} as const;

export type LevanteNormedTaskId = (typeof LEVANTE_NORMED_TASK_IDS)[keyof typeof LEVANTE_NORMED_TASK_IDS];
