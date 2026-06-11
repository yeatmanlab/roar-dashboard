import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the cross-task variant list request. Published variants are
 * bounded reference data, so the catalog usually fits in a few requests at the
 * contract's maximum page size; the query still follows the response's
 * pagination so larger catalogs are fetched completely rather than silently
 * truncated.
 */
const VARIANTS_LIST_PER_PAGE = 100;

/**
 * Cross-task variants query.
 *
 * Fetches every published task variant across all tasks from
 * `GET /task-variants?embed=parameters`. Returns the flat contract list-item
 * shape (`id`, `taskId`, `name`, `description`, `status`, `taskName`,
 * `taskSlug`, `taskImage`, `parameters`, ...). The `parameters` embed is
 * requested so consumers (e.g. CreateAdministration's variant ⇄ assessment
 * matching) can compare parameter sets without per-variant follow-up requests.
 *
 * Authorization note: the endpoint requires **super admin or platform
 * administrator** privileges — any other caller receives a 403. Only published
 * variants are returned regardless of role. Callers that need draft or
 * deprecated variants, or a per-task scope, should use
 * `useTaskVariantsByTaskQuery` instead.
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken` so
 * callers don't need to wire that condition themselves. Callers can pass
 * `queryOptions.enabled` to add additional conditions; `computeQueryOverrides`
 * AND's them together.
 *
 * @NOTE The legacy positional argument (`registeredVariantsOnly`) is gone —
 * the "registered" concept is replaced by the contract's publication status,
 * and this endpoint only ever returns published variants.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the variants array.
 */
const useTaskVariantsQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_VARIANTS_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const variants = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.taskVariants.list({
          query: { page, perPage: VARIANTS_LIST_PER_PAGE, embed: 'parameters' },
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

export default useTaskVariantsQuery;
