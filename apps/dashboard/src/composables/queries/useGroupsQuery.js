import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapGroupToOrg } from '@/helpers/mapOrg';
import { GROUPS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Groups (by ID) query.
 *
 * Fetches one or more groups by ID from the backend `GET /groups/:groupId`
 * endpoint, one request per id via `Promise.all`. The resolved array preserves
 * the order of the supplied `groupIds` so callers that index into it (e.g.
 * `useOrgQuery` with `select: (data) => data[0]`) keep working. The backend
 * authorizes each lookup, so callers receive only groups they can access.
 *
 * Unlike the legacy `fetchDocumentsById` (which silently dropped missing or
 * inaccessible ids), this query is all-or-nothing: a non-200 for any id rejects
 * the whole query. The sole caller (`useOrgQuery`) passes a single id, so a bad
 * id surfaces as a query error rather than a silent `data[0] === undefined`.
 *
 * Backend response objects (`GroupDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapGroupToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `groupIds` having entries.
 *
 * @param {import('vue').MaybeRefOrGetter<Array<string>>} groupIds – The group IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the groups array.
 */
const useGroupsQuery = (groupIds, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken), () => hasArrayEntries(groupIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [GROUPS_QUERY_KEY, groupIds],
    queryFn: async () => {
      const client = getRoarApiClient();
      const ids = toValue(groupIds) ?? [];

      // One request per id, preserving input order via Promise.all.
      const groups = await Promise.all(
        ids.map(async (id) => {
          const result = await client.groups.get({ params: { groupId: id } });

          if (result.status !== StatusCodes.OK) {
            const error = new Error(`Failed to fetch group ${id} with status ${result.status}`);
            error.status = result.status;
            error.body = result.body;
            throw error;
          }

          return result.body.data;
        }),
      );

      return groups.map(mapGroupToOrg);
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

export default useGroupsQuery;
