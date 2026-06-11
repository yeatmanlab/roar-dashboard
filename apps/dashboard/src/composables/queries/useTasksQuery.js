import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { TASKS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Page size for the tasks list request.
 *
 * Tasks are reference data with bounded cardinality, so the catalog usually
 * fits in a single request at the contract's maximum page size. The query
 * still follows the response's pagination so a catalog that outgrows one
 * page is fetched completely rather than silently truncated.
 */
const TASKS_LIST_PER_PAGE = 100;

/**
 * Tasks query.
 *
 * Fetches the task catalog from the backend `GET /tasks` endpoint. Returns the
 * flat task shape from the API contract (`id`, `slug`, `name`, `nameSimple`,
 * `nameTechnical`, `taskConfig`, ...).
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken` so
 * callers don't need to wire that condition themselves. Callers can pass
 * `queryOptions.enabled` to add additional conditions; `computeQueryOverrides`
 * AND's them together.
 *
 * @NOTE The legacy positional arguments (`registeredTasksOnly`, `taskIds`) are
 * gone. The "registered" concept is retired at the task level, and the contract
 * has no `?ids=` filter — consumers that need a subset filter the catalog
 * client-side by `task.id` or `task.slug`.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the task array.
 */
const useTasksQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASKS_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const tasks = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.tasks.list({ query: { page, perPage: TASKS_LIST_PER_PAGE } });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch tasks with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        tasks.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return tasks;
    },
    ...options,
    enabled: isQueryEnabled,
  });
};

export default useTasksQuery;
