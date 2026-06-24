import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const AGREEMENTS_PER_PAGE = 100;

/**
 * Administration agreements query.
 *
 * Fetches the agreements assigned to an administration from
 * `GET /administrations/:id/agreements`, following pagination so the full
 * assigned set is returned. Each item carries its `agreementType`
 * (`consent` / `assent` / `tos`) and current version, which the form uses to
 * pre-fill the consent/assent pickers when editing.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} administrationId - The administration UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the agreement array.
 */
const useAdministrationAgreementsQuery = (administrationId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(administrationId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_AGREEMENTS_QUERY_KEY, administrationId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const items = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.administrations.listAgreements({
          params: { id: toValue(administrationId) },
          query: { page, perPage: AGREEMENTS_PER_PAGE },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch administration agreements with status ${result.status}`);
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
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationAgreementsQuery;
