import { computed } from 'vue';
import { UseQueryReturnType } from '@tanstack/vue-query';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import { MaybeRef } from 'vue';

interface QueryOptions {
  enabled?: MaybeRef<boolean>;
  [key: string]: any;
}

interface Task {
  id: string;
  [key: string]: any;
}

interface TasksDictionary {
  [key: string]: Task;
}

/**
 * Tasks dictionary query.
 *
 * Leverage the useTasksQuery composable to fetch tasks and reduce them into a dictionary. This is useful for quickly
 * accessing tasks by ID without having to iterate over the potentially large tasks array.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryReturnType} The TanStack query result with the tasks dictionary.
 */
const useTasksDictionaryQuery = (
  queryOptions?: QueryOptions
): UseQueryReturnType<TasksDictionary, Error> => {
  const { data, ...queryState } = useTasksQuery(true, undefined, queryOptions);

  const tasksDictionary = computed(() => {
    return Array.isArray(data.value)
      ? data.value.reduce((acc, doc) => {
          acc[doc.id] = doc;
          return acc;
        }, {} as TasksDictionary)
      : {};
  });

  return { data: tasksDictionary, ...queryState };
};

export default useTasksDictionaryQuery; 