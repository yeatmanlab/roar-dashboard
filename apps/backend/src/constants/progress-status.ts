/**
 * 7-level priority scheme that orthogonalizes the progress axis (assigned → started
 * → completed) from the requirement axis (required vs optional).
 *
 * The old 5-level scheme (optional=0, assigned=1, started=2, completed=3) lost the
 * required/optional distinction once a student started or completed a task, because
 * the SQL CASE short-circuited on run state without evaluating conditions. The 7-level
 * scheme evaluates conditions for ALL students — including those with runs — so every
 * status encodes both axes. This enables accurate per-student completion tracking:
 * a student is "done" only when all their required tasks are at completed-required (5).
 *
 * Priority ordering (higher = higher priority for multi-variant dedup):
 *   completed-required (5) > completed-optional (4) > started-required (3) >
 *   started-optional (2) > assigned-required (1) > assigned-optional (0) > excluded (-1)
 *
 * These values appear in SQL CASE expressions (repository) and JS-level
 * buildProgressMap (service). Keep them in sync.
 */
export const PROGRESS_STATUS_PRIORITY = {
  'assigned-optional': 0,
  'assigned-required': 1,
  'started-optional': 2,
  'started-required': 3,
  'completed-optional': 4,
  'completed-required': 5,
} as const;

export type ProgressStatus = keyof typeof PROGRESS_STATUS_PRIORITY;
export type ProgressStatusPriority = (typeof PROGRESS_STATUS_PRIORITY)[ProgressStatus];

/**
 * Inverse mapping: priority number → status string.
 * Used by the repository to convert SQL aggregation results back to named statuses.
 */
export const PROGRESS_PRIORITY_TO_STATUS = {
  0: 'assigned-optional',
  1: 'assigned-required',
  2: 'started-optional',
  3: 'started-required',
  4: 'completed-optional',
  5: 'completed-required',
} as const satisfies Record<ProgressStatusPriority, ProgressStatus>;

/**
 * Helper sets for grouping statuses by progress axis.
 * Useful in the service layer when computing aggregate totals.
 */
export const REQUIRED_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'assigned-required',
  'started-required',
  'completed-required',
]);

export const OPTIONAL_STATUSES: ReadonlySet<ProgressStatus> = new Set([
  'assigned-optional',
  'started-optional',
  'completed-optional',
]);

export const ASSIGNED_STATUSES: ReadonlySet<ProgressStatus> = new Set(['assigned-required', 'assigned-optional']);

export const STARTED_STATUSES: ReadonlySet<ProgressStatus> = new Set(['started-required', 'started-optional']);

export const COMPLETED_STATUSES: ReadonlySet<ProgressStatus> = new Set(['completed-required', 'completed-optional']);
