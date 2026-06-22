import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;
const AGREEMENTS_PER_PAGE = 100;

/**
 * Agreements list query.
 *
 * Fetches agreements from `GET /agreements`, page-walked, optionally filtered by
 * type (`tos` | `assent` | `consent`). Each agreement carries its `id` (UUID),
 * `name`, `agreementType`, and `currentVersion` for the requested locale — so
 * callers (e.g. ConsentPicker) can present a list and resolve a selection to an
 * agreement UUID. Locale defaults to the contract default (`en-US`).
 *
 * @param {import('vue').MaybeRefOrGetter<string|undefined>} agreementType - Optional type filter.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the agreements array.
 */
const useAgreementsQuery = (agreementType = undefined, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [AGREEMENTS_QUERY_KEY, agreementType],
    queryFn: async () => {
      const client = getRoarApiClient();
      const type = toValue(agreementType);
      const agreements = [];
      let page = 1;
      let totalPages = 1;

      do {
        const result = await client.agreements.list({
          query: { page, perPage: AGREEMENTS_PER_PAGE, ...(type ? { agreementType: type } : {}) },
        });

        if (result.status !== StatusCodes.OK) {
          const error = new Error(`Failed to fetch agreements with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        agreements.push(...result.body.data.items);
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return agreements;
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

export default useAgreementsQuery;
