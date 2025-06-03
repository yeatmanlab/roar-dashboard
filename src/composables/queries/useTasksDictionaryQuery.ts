import { computed } from 'vue';
import useTasksQuery from '@/composables/queries/useTasksQuery';

/**
 * Tasks dictionary query.
 *
 * Leverage the useTasksQuery composable to fetch tasks and reduce them into a dictionary. This is useful for quickly
 * accessing tasks by ID without having to iterate over the potentially large tasks array.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result with the tasks dictionary.
 */
const useTasksDictionaryQuery = (queryOptions = undefined) => {
  const { data, ...queryState } = useTasksQuery(true, undefined, queryOptions);

  const tasksDictionary = computed(() => {
    return Array.isArray(data.value)
      ? data.value.reduce((acc, doc) => {
          acc[doc.id] = doc;
          return acc;
        }, {})
      : {};
  });

  return { data: tasksDictionary, ...queryState };
};

export default useTasksDictionaryQuery;
