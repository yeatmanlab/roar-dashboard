import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const TASK_VARIANTS_PER_PAGE = 100;

/**
 * Cross-task published task-variants list query.
 *
 * Fetches all published task variants across all tasks from `GET /task-variants`
 * (super-admin), page-walked so the full catalog is returned. Returns the flat
 * variant shape from the contract (`id`, `taskId`, `name`, `status`, `taskName`,
 * `taskSlug`, `taskImage`, `parameters`) with `embed=parameters`.
 *
 * Intended as the picker source for administration authoring — consumers read
 * the flat shape directly (no legacy nesting).
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the variant array.
 */
const useTaskVariantsListQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_VARIANTS_QUERY_KEY, 'list'],
    queryFn: async () => {
      const client = getRoarApiClient();
      const variants = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.taskVariants.list({
          query: { page, perPage: TASK_VARIANTS_PER_PAGE, embed: 'parameters' },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch task variants with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        variants.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return variants;
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

export default useTaskVariantsListQuery;
