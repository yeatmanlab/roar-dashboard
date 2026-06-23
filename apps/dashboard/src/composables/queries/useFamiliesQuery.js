import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapFamilyToOrg } from '@/helpers/mapOrg';
import { FAMILIES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Families (by ID) query.
 *
 * Fetches one or more families by ID from the backend `GET /families/:familyId`
 * endpoint, one request per id via `Promise.all`. The resolved array preserves
 * the order of the supplied `familyIds` so callers that index into it (e.g.
 * `useOrgQuery` with `select: (data) => data[0]`) keep working. The backend
 * authorizes each lookup, so callers receive only families they can access.
 *
 * `GET /families/:familyId` is parent-only (FGA `can_read: parent`): only the
 * family's caretaker or a super admin may read it — unlike org and group reads,
 * no admin or supervisory role grants access. That matches the legitimate
 * consumer (a caretaker viewing their own family) and super admins; everyone
 * else (including org admins) receives 403.
 *
 * Unlike the legacy `fetchDocumentsById` (which silently dropped missing or
 * inaccessible ids), this query is all-or-nothing: a non-200 for any id rejects
 * the whole query. The sole caller (`useOrgQuery`) passes a single id, so a bad
 * id surfaces as a query error rather than a silent `data[0] === undefined`.
 *
 * Backend response objects (`FamilyDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapFamilyToOrg`. Note that the family shape
 * is minimal (`{ id, location?, rosteringEnded? }`, no `name`); the only
 * consumer's `orgData.name` read lands on the vestigial family-report path (no
 * administration is ever assigned to a `family` org), so the absence is
 * inconsequential — see `mapFamilyToOrg`'s JSDoc.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `familyIds` having entries.
 *
 * @param {import('vue').MaybeRefOrGetter<Array<string>>} familyIds – The family IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the families array.
 */
const useFamiliesQuery = (familyIds, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken), () => hasArrayEntries(familyIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [FAMILIES_QUERY_KEY, familyIds],
    queryFn: async () => {
      const client = getRoarApiClient();
      const ids = toValue(familyIds) ?? [];

      // One request per id, preserving input order via Promise.all.
      const families = await Promise.all(
        ids.map(async (id) => {
          const result = await client.families.get({ params: { familyId: id } });

          if (result.status !== StatusCodes.OK) {
            const error = new Error(`Failed to fetch family ${id} with status ${result.status}`);
            error.status = result.status;
            error.body = result.body;
            throw error;
          }

          return result.body.data;
        }),
      );

      return families.map(mapFamilyToOrg);
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

export default useFamiliesQuery;
