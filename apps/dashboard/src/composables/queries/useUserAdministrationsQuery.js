import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { USER_ADMINISTRATIONS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the user administrations list request.
 *
 * A student's assigned administrations are bounded data, so the list usually
 * fits in a single request at the contract's maximum page size; the query
 * still follows the response's pagination so a larger list is fetched
 * completely rather than silently truncated.
 */
const USER_ADMINISTRATIONS_LIST_PER_PAGE = 100;

/**
 * Embed options requested for the student homepage.
 *
 * `progress` implies `tasks` on the backend, but both are requested explicitly
 * for clarity. With `progress`, each task carries the target user's per-task
 * `optional`, `assigned`, and `progress` (`startedOn`, `completedOn`,
 * `allowRetake`) — all computed by the backend for the in-context user.
 */
const USER_ADMINISTRATIONS_EMBED = 'tasks,progress';

/**
 * User administrations query.
 *
 * Fetches a user's administrations from `GET /users/:userId/administrations`
 * via the typed ts-rest client, with `?embed=tasks,progress` so each
 * administration's `tasks` carry the target student's per-task `optional`,
 * `assigned`, and `progress` (`startedOn`, `completedOn`, `allowRetake`). These
 * are computed by the backend for the in-context user and must NOT be
 * re-derived on the client. Returns the flat contract administration shape
 * (`id`, `name`, `publicName`, `dates`, `isOrdered`, `tasks`).
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken` AND
 * a truthy `userId` so callers don't have to wire those conditions themselves;
 * callers can add conditions via `queryOptions.enabled` and `computeQueryOverrides`
 * AND's them together.
 *
 * @param {Ref<String>|String} userId – The target user's ROAR (Postgres) UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the administrations array.
 */
const useUserAdministrationsQuery = (userId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(userId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [USER_ADMINISTRATIONS_QUERY_KEY, userId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const administrations = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.users.listUserAdministrations({
          params: { userId: toValue(userId) },
          query: { embed: USER_ADMINISTRATIONS_EMBED, page, perPage: USER_ADMINISTRATIONS_LIST_PER_PAGE },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch user administrations with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        administrations.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return administrations;
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

export default useUserAdministrationsQuery;
