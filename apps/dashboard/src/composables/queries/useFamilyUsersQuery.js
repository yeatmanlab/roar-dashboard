import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { FAMILY_USERS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the family users list request.
 *
 * A family's membership is small (capped at `FAMILY_SIZE_LIMIT` server-side), so
 * the list usually fits in a single request; the query still follows the
 * response's pagination so a larger list is fetched completely rather than
 * silently truncated.
 */
const FAMILY_USERS_PER_PAGE = 100;

/**
 * Family users query (backend API).
 *
 * Fetches the active members of a family from `GET /v1/families/:familyId/users`
 * via the typed ts-rest client, optionally filtered by `role` (`parent` |
 * `child`) and `grade`. Returns the array of enrolled family users — each is a
 * full user record (ROAR/Postgres `id`, `nameFirst`, `nameLast`, …) extended
 * with the member's family `roles`. The returned `id` is the ROAR user UUID the
 * per-user endpoints (`GET /v1/users/:id`, `GET /v1/users/:userId/administrations`)
 * expect — NOT a Firebase UID.
 *
 * This is the API-backed replacement for reading `childrenUids` off the parent's
 * Firestore user document; the parent dashboard lists children via
 * `useFamilyUsersQuery(familyId, { role: 'child' })`.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy
 * `familyId` so callers don't have to wire those conditions themselves; callers
 * can add conditions via `queryOptions.enabled` and `computeQueryOverrides`
 * AND's them together. The query stays idle until the parent's `familyId` is
 * resolved from `/me`.
 *
 * @param {Ref<String>|String} familyId – The family's UUID.
 * @param {{ role?: Ref<String>|String, grade?: Ref<String>|String }} [filters] – Optional role/grade filters.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the family members array.
 */
const useFamilyUsersQuery = (familyId, { role = undefined, grade = undefined } = {}, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(familyId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [FAMILY_USERS_QUERY_KEY, familyId, role, grade],
    queryFn: async () => {
      const client = getRoarApiClient();
      const members = [];
      let page = 1;
      let totalPages = 1;
      const roleValue = toValue(role);
      const gradeValue = toValue(grade);

      do {
        const result = await client.families.listUsers({
          params: { familyId: toValue(familyId) },
          query: {
            page,
            perPage: FAMILY_USERS_PER_PAGE,
            ...(roleValue ? { role: roleValue } : {}),
            ...(gradeValue ? { grade: gradeValue } : {}),
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch family users with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        members.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return members;
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

export default useFamilyUsersQuery;
