/**
 * Helpers for turning a participant's administration (from the ts-rest backend
 * `GET /users/:userId/administrations?embed=tasks,progress` endpoint) into the
 * "game" objects the student homepage and `GameTabs` consume.
 *
 * The backend computes `optional`, `assigned`, and `progress` for the target
 * student and attaches them to each task, so this mapping passes them straight
 * through — there is NO client-side condition evaluation. The task catalog only
 * supplies presentational fields (name, image, external/URL config).
 */

import { findTaskByIdOrSlug } from '@/helpers/taskIdentifiers';

/**
 * Whether a game's external launch URL needs the participant's org membership
 * IDs (`schoolId` / `classId`).
 *
 * Mirrors the generic-external branch of `GameTabs.externalLinksByTask`: a task
 * with an external URL that is neither `qualtrics` (needs only `assessmentPid`)
 * nor `mefs` (needs only age, derived from `dob`) builds its URL with
 * `schoolId` / `classId`. The participant homepage uses this to fetch the
 * memberships read **only** when such a task is present — internal-only
 * administrations make no extra call.
 *
 * @param {Object} game – A game object from {@link mapAdministrationTasksToGames}.
 * @returns {boolean} True when the game's launch URL needs org membership IDs.
 */
export function gameNeedsOrgMemberships(game) {
  const hasExternalUrl = Boolean(game?.taskData?.variantURL || game?.taskData?.taskURL);
  if (!hasExternalUrl) return false;
  const taskId = String(game?.taskId ?? '');
  return !taskId.includes('qualtrics') && !taskId.includes('mefs');
}

/**
 * Map a single administration task (with embedded per-student state) plus the
 * matched catalog task into a homepage game object.
 *
 * @param {Object} task – An administration task from the API (`taskId`, `orderIndex`,
 *   `optional`, `assigned`, `progress`).
 * @param {Object|undefined} matchedTask – The catalog task matched by UUID/slug, if any.
 * @returns {Object} The game object consumed by the template and `GameTabs`.
 */
function toGame(task, matchedTask) {
  const progress = task.progress ?? {};

  return {
    // GameTabs routes and translates by the task's slug (`/game/<slug>`), so
    // expose the catalog slug as the game's `taskId`. Fall back to the API
    // UUID if the catalog has no match (defensive — keeps the tab rendering).
    taskId: matchedTask?.slug ?? task.taskId,
    orderIndex: task.orderIndex,
    optional: task.optional,
    assigned: task.assigned,
    // Normalise nullable progress timestamps to `undefined` so GameTabs'
    // truthiness checks (and its `completedOn === undefined` incomplete check)
    // behave the same as they did with the Firestore data shape.
    startedOn: progress.startedOn ?? undefined,
    completedOn: progress.completedOn ?? undefined,
    // `allowRetake` is authoritative from the backend (it already applies the
    // validity-checking exclusion); GameTabs gates retakes on it directly.
    allowRetake: progress.allowRetake ?? false,
    taskData: {
      ...matchedTask,
      // GameTabs consumes the legacy `external` / `taskURL` / `meta` fields, which aren't first-class on
      // the new contract shape — Firestore-era extras live inside the task's `taskConfig` jsonb. Map them
      // out defensively: `taskConfig` is free-form JSON, so tasks whose config lacks these keys (or isn't
      // an object) fall back to a non-external rendering instead of breaking the assessment list. The
      // mapping can go away once GameTabs reads `taskConfig` directly.
      external: matchedTask?.taskConfig?.external ?? false,
      taskURL: matchedTask?.taskConfig?.taskURL,
      meta: matchedTask?.taskConfig?.meta,
      // `variantURL` is intentionally not carried here: the decision was to drop
      // variant-level URLs, so GameTabs falls back to `taskURL` for external
      // links. This omission is deliberate, not an oversight.
    },
  };
}

/**
 * Build the list of game objects for an administration, filtered to the tasks
 * assigned to the target student.
 *
 * @param {Object|null|undefined} administration – The selected administration (with `tasks`).
 * @param {Array<Object>|null|undefined} taskCatalog – The task catalog (from `useTasksQuery`).
 * @returns {Array<Object>} Game objects for assigned tasks (empty when no administration/tasks).
 */
export function mapAdministrationTasksToGames(administration, taskCatalog) {
  return (administration?.tasks ?? [])
    .filter((task) => task.assigned === true)
    .map((task) => toGame(task, findTaskByIdOrSlug(taskCatalog, task.taskId)));
}
