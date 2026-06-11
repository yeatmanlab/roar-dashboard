import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_BUNDLES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the task bundle list request. Bundles are curated reference
 * data with bounded cardinality, so the list usually fits in a single request
 * at the contract's maximum page size; the query still follows the response's
 * pagination so a list that outgrows one page is fetched completely.
 */
const TASK_BUNDLES_LIST_PER_PAGE = 100;

/**
 * Task bundles query.
 *
 * Fetches the task bundle catalog from
 * `GET /task-bundles?embed=taskVariantDetails`. Returns the flat contract
 * bundle shape (`id`, `slug`, `name`, `description`, `image`,
 * `taskVariants`, ...). The `taskVariantDetails` embed is requested so each
 * bundle's `taskVariants` entries carry `taskId` (plus the full variant
 * details) — consumers resolve bundle entries against the variant catalog
 * grouped by task, which needs the task UUID on every entry.
 *
 * Authorization note: the endpoint requires **super admin or platform
 * administrator** privileges — any other caller receives a 403.
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken` so
 * callers don't need to wire that condition themselves. Callers can pass
 * `queryOptions.enabled` to add additional conditions; `computeQueryOverrides`
 * AND's them together.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the bundles array.
 */
const useTaskBundlesQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_BUNDLES_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const bundles = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.taskBundles.list({
          query: { page, perPage: TASK_BUNDLES_LIST_PER_PAGE, embed: 'taskVariantDetails' },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch task bundles with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        bundles.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return bundles;
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying
    // delays the user-facing error UX. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useTaskBundlesQuery;
