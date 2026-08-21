import { computed, toValue } from 'vue';
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
 * Administrations list query (server-driven pagination, sort, and search).
 *
 * Fetches a single page of administrations accessible to the caller from the
 * backend `GET /administrations` endpoint. The API scopes results to the caller's
 * permissions, paginates, sorts, and (when `search` is provided) filters by name —
 * so the consumer no longer walks every page or filters client-side. Super admins
 * additionally request `embed=stats` for the per-administration completion doughnut;
 * partner admins omit it (the doughnut is super-admin only and stats are
 * comparatively expensive to compute).
 *
 * **Reactivity.** `page`, `perPage`, `sortBy`, `sortOrder`, and `search` are accepted
 * as refs/getters and included in the query key by reference (not `.value`), so the
 * query re-keys and refetches whenever any of them change. `isSuperAdmin` stays in the
 * key too, since super admins and partner admins fetch different embeds and must not
 * share a cache entry.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API call) and
 * on user claims having loaded (to settle super-admin status before the first request).
 * Callers can pass `queryOptions.enabled` to add conditions; `computeQueryOverrides`
 * AND's them together.
 *
 * @NOTE The per-administration `assessments` array is the `embed=tasks` payload
 * (task/variant ids, names, and order); it does not include per-variant parameters,
 * which live on the task-variant resource.
 *
 * @param {import('vue').MaybeRefOrGetter<number>} page – Current 1-indexed page.
 * @param {import('vue').MaybeRefOrGetter<number>} perPage – Page size.
 * @param {import('vue').MaybeRefOrGetter<string>} sortBy – Sort field (name|dateStart|dateEnd).
 * @param {import('vue').MaybeRefOrGetter<string>} sortOrder – Sort direction (asc|desc).
 * @param {import('vue').MaybeRefOrGetter<string>} search – Case-insensitive name filter (empty = no filter).
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} TanStack query result resolving to `{ items, pagination }`.
 */
const useAdministrationsListQuery = (page, perPage, sortBy, sortOrder, search, queryOptions = undefined) => {
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
    // The page/sort/search inputs are part of the cache key so each distinct view of
    // the list is cached separately and the query refetches when any of them change.
    // isSuperAdmin also discriminates the cache: super admins fetch embed=stats,tasks
    // while everyone else fetches embed=tasks. Pass each input by reference (not `.value`)
    // so the key stays reactive — a snapshot would freeze the pre-claims/pre-interaction state.
    queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY, isSuperAdmin, page, perPage, sortBy, sortOrder, search],
    queryFn: async () => {
      const client = getRoarApiClient();
      const searchTerm = toValue(search);

      const result = await client.administrations.list({
        query: {
          page: toValue(page),
          perPage: toValue(perPage),
          sortBy: toValue(sortBy),
          sortOrder: toValue(sortOrder),
          // `tasks` powers the per-card assessment list for every role; `stats`
          // powers the completion doughnut, which is super-admin only — so only
          // super admins pay for the (more expensive) stats computation.
          embed: isSuperAdmin.value ? 'stats,tasks' : 'tasks',
          // Only send `search` when there is a non-empty term so the cache key for the
          // unfiltered view stays clean and the backend skips the filter entirely.
          ...(searchTerm ? { search: searchTerm } : {}),
        },
      });

      if (result.status !== StatusCodes.OK) {
        // Surface non-200 ts-rest results as thrown errors so TanStack routes them
        // through `error`. The thrown shape carries the ts-rest response so downstream
        // error handlers can introspect it.
        const error = new Error(`Failed to fetch administrations with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Return the page payload so the consumer gets both the current page's rows and
      // the pagination envelope (for totalRecords). Surface the embedded `tasks` as each
      // card's `assessments` list; this shape (taskId, taskName, variantId, variantName,
      // orderIndex) intentionally omits per-variant parameters.
      return {
        items: result.body.data.items.map((administration) => ({
          ...administration,
          assessments: administration.tasks ?? [],
        })),
        pagination: result.body.data.pagination,
      };
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying only delays
    // the user-facing error. Placed after `...options` so a caller-supplied `retry` can't
    // silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationsListQuery;
