import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_PROGRESS_OVERVIEW_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Administration progress overview query.
 *
 * Fetches aggregated completion statistics for an administration from
 * `GET /v1/administrations/:id/reports/progress/overview`, scoped to a specific
 * org/class/group via `scopeType` + `scopeId`. The overview is a single,
 * un-paginated request.
 *
 * Returns the domain overview object: per-student assignment-level totals
 * (`studentsAssigned` / `studentsStarted` / `studentsCompleted`,
 * `studentsWithRequiredTasks`, `totalStudents`), a `byTask` array of per-task
 * counts, `computedAt`, and `exclusions`.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `scopeType` / `scopeId`; callers AND additional conditions
 * via `queryOptions.enabled`.
 *
 * @param {Ref<String>|String} administrationId – The administration's UUID.
 * @param {Ref<String>|String} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {Ref<String>|String} scopeId – The scoping entity's UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} Resolves to the progress overview object.
 */
const useAdministrationProgressOverviewQuery = (administrationId, scopeType, scopeId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(administrationId)),
    () => Boolean(toValue(scopeType)),
    () => Boolean(toValue(scopeId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    // Pass scope params as-is (ref or string) so reactive callers update the key;
    // TanStack unwraps refs in the key array, matching the canonical composable.
    queryKey: [ADMINISTRATION_PROGRESS_OVERVIEW_QUERY_KEY, administrationId, scopeType, scopeId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.progressReports.getProgressOverview({
        params: { id: toValue(administrationId) },
        query: { scopeType: toValue(scopeType), scopeId: toValue(scopeId) },
      });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch administration progress overview with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Unwrap the success envelope: { data: { ...overview } }.
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

export default useAdministrationProgressOverviewQuery;
