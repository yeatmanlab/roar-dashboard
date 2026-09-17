import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the variant list request. A task's variants are bounded
 * reference data, so the list usually fits in a single request at the
 * contract's maximum page size; the query still follows the response's
 * pagination so larger lists are fetched completely.
 */
const VARIANTS_LIST_PER_PAGE = 100;

/**
 * Per-task variants query.
 *
 * Fetches a task's variants from `GET /tasks/:taskId/variants`, optionally
 * filtered by publication status (`draft | published | deprecated`). Returns
 * the flat contract variant shape (`id`, `taskId`, `name`, `description`,
 * `status`, `parameters`, ...).
 *
 * Authorization note: all users see published variants; only super admins see
 * drafts and deprecated variants (the backend enforces this regardless of the
 * status filter sent).
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy
 * `taskId`; callers can add conditions via `queryOptions.enabled`.
 *
 * @param {Ref<String>|String} taskId – The task's UUID or slug.
 * @param {Ref<String>|String|undefined} [status=undefined] – Optional status filter; omit for all visible statuses.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the variants array.
 */
const useTaskVariantsByTaskQuery = (taskId, status = undefined, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(taskId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_VARIANTS_QUERY_KEY, taskId, status],
    queryFn: async () => {
      const client = getRoarApiClient();
      const statusValue = toValue(status);
      const variants = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.tasks.listTaskVariants({
          params: { taskId: toValue(taskId) },
          query: {
            page,
            perPage: VARIANTS_LIST_PER_PAGE,
            ...(statusValue ? { status: statusValue } : {}),
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
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

export default useTaskVariantsByTaskQuery;
