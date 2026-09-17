import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const TASK_VARIANTS_PER_PAGE = 100;

/**
 * Administration task-variants query.
 *
 * Fetches the task variants assigned to an administration from
 * `GET /administrations/:id/task-variants`, ordered by `orderIndex`, following
 * pagination so the full assigned set is returned. Each item carries its task
 * info and assignment conditions.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the task-variant array.
 */
const useAdministrationTaskVariantsQuery = (administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_TASK_VARIANTS_QUERY_KEY, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const items = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.administrations.listTaskVariants({
          params: { id: toValue(administrationId) },
          query: { page, perPage: TASK_VARIANTS_PER_PAGE, sortBy: 'orderIndex', sortOrder: 'asc' },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch administration task variants with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        items.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return items;
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

export default useAdministrationTaskVariantsQuery;
