/**
 * Tasks excluded from retake eligibility.
 *
 * A student is normally allowed to retake an assessment when their canonical
 * (best) run was unreliable. Some tasks, however, do not implement validity
 * checking — their `reliableRun` flag is not meaningful — so retakes must be
 * suppressed for them regardless of the flag.
 *
 * This set is keyed by task **slug** (e.g. `roar-anb`), matched against
 * `tasks.slug`, NOT the task UUID. It combines:
 * - the standard ROAR tasks that lack validity checking, and
 * - the full LEVANTE task suite (`LEVANTE_TASK_IDS`).
 *
 * Canonical backend copy: this list is the single source of truth going
 * forward. The matching frontend list
 * (`apps/dashboard/src/constants/tasksExcludedFromRetake.js`) will be retired
 * in the student-dashboard frontend cutover PR, once `allowRetake` is sourced
 * authoritatively from this backend embed.
 */
export const TASKS_EXCLUDED_FROM_RETAKE: ReadonlySet<string> = new Set([
  // Standard ROAR tasks without validity checking
  'roar-anb',
  'roar-survey',
  'ran',
  'ran-pt',
  'roav-mep',
  'roav-phonics',
  'crowding',
  'crowding-pt',
  'roar-readaloud',
  // LEVANTE task suite (kebab-case slugs, mirrors LEVANTE_TASK_IDS)
  'hearts-and-flowers',
  'egma-math',
  'matrix-reasoning',
  'memory-game',
  'mental-rotation',
  'same-different-selection',
  'theory-of-mind',
  'trog',
  'mefs',
  'roar-inference',
]);
