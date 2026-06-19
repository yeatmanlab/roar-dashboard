import { computed } from 'vue';
import useTasksQuery from '@/composables/queries/useTasksQuery';

/**
 * Tasks dictionary query.
 *
 * Thin selector over `useTasksQuery` that reduces the task catalog into a
 * dictionary for O(1) lookups.
 *
 * Each task is keyed by **both** its `id` (UUID) and its `slug` (e.g.,
 * `'phonics'`). Legacy consumers look tasks up by their Firestore-era task ID,
 * which corresponds to the new contract's `slug`, while newer consumers use
 * the backend UUID — dual keying keeps both lookup styles working.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result with the tasks dictionary.
 */
const useTasksDictionaryQuery = (queryOptions = undefined) => {
  const { data, ...queryState } = useTasksQuery(queryOptions);

  const tasksDictionary = computed(() => {
    if (!Array.isArray(data.value)) return {};

    return data.value.reduce((acc, task) => {
      acc[task.id] = task;
      acc[task.slug] = task;
      return acc;
    }, {});
  });

  return { data: tasksDictionary, ...queryState };
};

export default useTasksDictionaryQuery;
