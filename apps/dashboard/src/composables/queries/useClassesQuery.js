import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { mapClassToOrg } from '@/helpers/mapOrg';
import { CLASSES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Classes (by ID) query.
 *
 * Fetches one or more classes by ID from the backend `GET /classes/:classId`
 * endpoint, one request per id via `Promise.all`. The resolved array preserves
 * the order of the supplied `classIds` so callers that index into it (e.g.
 * `useOrgQuery` with `select: (data) => data[0]`) keep working. The backend
 * authorizes each lookup, so callers receive only classes they can access.
 *
 * Unlike the legacy `fetchDocumentsById` (which silently dropped missing or
 * inaccessible ids), this query is all-or-nothing: a non-200 for any id rejects
 * the whole query. The sole caller (`useOrgQuery`) passes a single id, so a bad
 * id surfaces as a query error rather than a silent `data[0] === undefined`.
 *
 * Backend response objects (`ClassDetailSchema`) are mapped to the flat org
 * shape the consumers expect — see `mapClassToOrg`.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `classIds` having entries.
 *
 * @param {import('vue').MaybeRefOrGetter<Array<string>>} classIds – The class IDs to fetch.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the classes array.
 */
const useClassesQuery = (classIds, queryOptions = undefined) => {
  const authStore = useAuthStore();

  const conditions = [() => Boolean(authStore.accessToken), () => hasArrayEntries(classIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [CLASSES_QUERY_KEY, classIds],
    queryFn: async () => {
      const client = getRoarApiClient();
      const ids = toValue(classIds) ?? [];

      // One request per id, preserving input order via Promise.all.
      const classes = await Promise.all(
        ids.map(async (id) => {
          const result = await client.classes.get({ params: { classId: id } });

          if (result.status !== StatusCodes.OK) {
            const error = new Error(`Failed to fetch class ${id} with status ${result.status}`);
            error.status = result.status;
            error.body = result.body;
            throw error;
          }

          return result.body.data;
        }),
      );

      return classes.map(mapClassToOrg);
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

export default useClassesQuery;
