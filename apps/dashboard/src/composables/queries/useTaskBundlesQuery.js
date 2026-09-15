import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_BUNDLES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const TASK_BUNDLES_PER_PAGE = 100;

/**
 * Task-bundles list query.
 *
 * Fetches all task bundles from `GET /task-bundles` (super-admin), page-walked so
 * the full catalog is returned. Requests `embed=taskVariantDetails` so each
 * bundle's variants carry the per-variant `taskId` (and other detail fields) the
 * picker needs to resolve bundle variants against the variant catalog
 * (`useTaskVariantsListQuery`).
 *
 * Returns the flat backend bundle shape from the contract
 * (`id`, `slug`, `name`, `description`, `image`, `taskVariants[]`). Consumers that
 * feed the administration-form `TaskPicker` should adapt it via
 * `adaptBundlesForPicker`.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the bundle array.
 */
const useTaskBundlesQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_BUNDLES_QUERY_KEY, 'list'],
    queryFn: async () => {
      const client = getRoarApiClient();
      const bundles = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.taskBundles.list({
          query: { page, perPage: TASK_BUNDLES_PER_PAGE, embed: 'taskVariantDetails' },
        });

        if (result.status !== StatusCodes.OK) {
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
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useTaskBundlesQuery;
