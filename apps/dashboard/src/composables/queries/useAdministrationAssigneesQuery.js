import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_ASSIGNEES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Administration assignees query.
 *
 * Fetches the entities directly assigned to an administration from
 * `GET /administrations/:id/assignees`, grouped by type:
 * `{ districts, schools, classes, groups }`. The response is not paginated —
 * administrations are assigned to a small number of entities.
 *
 * @NOTE The response has no `families` bucket; administration assignees are
 * districts/schools/classes/groups only.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the assignees object.
 */
const useAdministrationAssigneesQuery = (administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_ASSIGNEES_QUERY_KEY, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.getAssignees({ params: { id: toValue(administrationId) } });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch administration assignees with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      return result.body.data;
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

export default useAdministrationAssigneesQuery;
