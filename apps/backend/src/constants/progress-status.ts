/**
 * Numeric priority for each progress status. Higher value = higher priority.
 * Used for multi-variant deduplication: when a student has multiple variants
 * for the same task, the highest-priority status wins.
 *
 * These values appear in SQL CASE expressions (repository) and JS-level
 * buildProgressMap (service). Keep them in sync.
 */
export const PROGRESS_STATUS_PRIORITY = {
  optional: 0,
  assigned: 1,
  started: 2,
  completed: 3,
} as const;

export type ProgressStatus = keyof typeof PROGRESS_STATUS_PRIORITY;
export type ProgressStatusPriority = (typeof PROGRESS_STATUS_PRIORITY)[ProgressStatus];

/**
 * Inverse mapping: priority number → status string.
 * Used by the repository to convert SQL aggregation results back to named statuses.
 */
export const PROGRESS_PRIORITY_TO_STATUS: Readonly<Record<ProgressStatusPriority, ProgressStatus>> = {
  0: 'optional',
  1: 'assigned',
  2: 'started',
  3: 'completed',
} as const;
