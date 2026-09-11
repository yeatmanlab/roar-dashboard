/**
 * Helpers for matching backend tasks against legacy task identifiers.
 *
 * The backend task shape has a UUID `id` and a `slug` (e.g. 'swr'). Legacy
 * identifiers stored on assessments (`assessment.taskId`) are Firestore-era
 * document IDs, which correspond to the new contract's `slug` — so consumers
 * resolving tasks from a legacy identifier must match on either field.
 */

/**
 * Find the task matching a legacy task identifier.
 *
 * @param {Array<Object>|undefined|null} tasks – The task catalog.
 * @param {String} taskId – A task identifier: backend UUID or legacy slug.
 * @returns {Object|undefined} The matching task, if any.
 */
export function findTaskByIdOrSlug(tasks, taskId) {
  return (tasks ?? []).find((task) => task.id === taskId || task.slug === taskId);
}

/**
 * Filter the task catalog down to tasks matching any of the given identifiers.
 *
 * Uses a Set for O(1) membership checks so the filter stays O(n) over the
 * catalog regardless of how many identifiers are requested.
 *
 * @param {Array<Object>|undefined|null} tasks – The task catalog.
 * @param {Array<String>|undefined|null} taskIds – Task identifiers: backend UUIDs or legacy slugs.
 * @returns {Array<Object>} The matching tasks (empty when either input is empty).
 */
export function filterTasksByIdOrSlug(tasks, taskIds) {
  const taskIdSet = new Set(taskIds ?? []);
  if (taskIdSet.size === 0) return [];
  return (tasks ?? []).filter((task) => taskIdSet.has(task.id) || taskIdSet.has(task.slug));
}
