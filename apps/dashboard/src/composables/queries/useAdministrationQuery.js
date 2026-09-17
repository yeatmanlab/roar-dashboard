import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Single administration query.
 *
 * Fetches one administration's base fields from `GET /administrations/:id`
 * (`id`, `name`, `publicName`, `dates`, `isOrdered`). Assigned orgs and task
 * variants are separate sub-resources — see `useAdministrationAssigneesQuery`
 * and `useAdministrationTaskVariantsQuery`.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the administration.
 */
const useAdministrationQuery = (administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_QUERY_KEY, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.get({ params: { id: toValue(administrationId) } });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch administration with status ${result.status}`);
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

export default useAdministrationQuery;
