import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import { ADMINISTRATIONS_LIST_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the administrations list request.
 *
 * `HomeAdministrator` paginates and sorts the list client-side, so the query
 * walks the response's pagination and returns the complete set rather than a
 * single server page.
 */
const ADMINISTRATIONS_LIST_PER_PAGE = 100;

/**
 * Administrations list query.
 *
 * Fetches the administrations accessible to the caller from the backend
 * `GET /administrations` endpoint. The API already scopes results to the
 * caller's permissions, so the legacy id-prefetch is gone. Super admins
 * additionally request `embed=stats` for the per-administration completion
 * doughnut; partner admins omit it (the doughnut is super-admin only and stats
 * are comparatively expensive to compute).
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API call)
 * and on user claims having loaded (to settle super-admin status before the
 * first request). Callers can pass `queryOptions.enabled` to add conditions;
 * `computeQueryOverrides` AND's them together.
 *
 * @NOTE The legacy `testData` concept is retired — there is no test/non-test
 * administration split any more, so the `testAdministrationsOnly` argument and
 * its cache discriminator are gone. The per-administration `assessments` array
 * is the `embed=tasks` payload (task/variant ids, names, and order); it does not
 * include per-variant parameters, which live on the task-variant resource.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the administration array.
 */
const useAdministrationsListQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();

  // Claims drive whether we request embedded stats (super-admin-only doughnut).
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });
  const { isSuperAdmin } = useUserType(userClaims);
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));

  const conditions = [() => Boolean(authStore.accessToken), () => claimsLoaded.value];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY],
    queryFn: async () => {
      const client = getRoarApiClient();
      const administrations = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.administrations.list({
          query: {
            page,
            perPage: ADMINISTRATIONS_LIST_PER_PAGE,
            sortBy: 'name',
            sortOrder: 'asc',
            // `tasks` powers the per-card assessment list for every role; `stats`
            // powers the completion doughnut, which is super-admin only — so only
            // super admins pay for the (more expensive) stats computation.
            embed: isSuperAdmin.value ? 'stats,tasks' : 'tasks',
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Surface non-200 ts-rest results as thrown errors so TanStack routes
          // them through `error`. The thrown shape carries the ts-rest response
          // so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch administrations with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        administrations.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      // Surface the embedded `tasks` as the card's `assessments` list. This list
      // shape (taskId, taskName, variantId, variantName, orderIndex) intentionally
      // omits per-variant parameters, which live on the task-variant resource.
      return administrations.map((administration) => ({
        ...administration,
        assessments: administration.tasks ?? [],
      }));
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying only
    // delays the user-facing error. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationsListQuery;
