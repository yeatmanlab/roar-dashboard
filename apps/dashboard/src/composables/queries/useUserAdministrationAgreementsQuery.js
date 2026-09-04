import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const AGREEMENTS_PER_PAGE = 100;

/**
 * User administration agreements query.
 *
 * Fetches an administration's required agreements, annotated with the target
 * user's signed status, from
 * `GET /users/:userId/administrations/:administrationId/agreements`, following
 * pagination so the full required set is returned. Each item carries its
 * `agreementType` (`consent` / `assent` / `tos`), `currentVersion`, and a
 * server-computed `signed` boolean that already encodes "the user has signed
 * the current version" (so annual re-consent / version bumps are handled
 * server-side — there is NO client-side renewal-date logic).
 *
 * This is the canonical signal for the per-administration consent/assent gate
 * on the student homepage: the client selects the age-appropriate agreement
 * (`consent` vs `assent`), ignores `tos` (gated elsewhere via `/me` + the
 * router guard), and shows the modal whenever the chosen agreement is unsigned.
 *
 * **Enablement.** The query is internally gated on `authStore.accessToken` AND
 * a truthy `userId` AND a truthy `administrationId` so callers don't have to
 * wire those conditions themselves; callers can add conditions via
 * `queryOptions.enabled` and `computeQueryOverrides` AND's them together.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} userId - The target user's ROAR (Postgres) UUID.
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the agreement array.
 */
const useUserAdministrationAgreementsQuery = (userId, administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(userId)),
    () => Boolean(toValue(administrationId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY, userId, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const items = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.users.listUserAdministrationAgreements({
          params: { userId: toValue(userId), administrationId: toValue(administrationId) },
          query: { page, perPage: AGREEMENTS_PER_PAGE },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch user administration agreements with status ${result.status}`);
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

export default useUserAdministrationAgreementsQuery;
