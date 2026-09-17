import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_INDIVIDUAL_REPORT_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Administration individual-student-report query (administrator path).
 *
 * Fetches one student's complete scoreboard for one administration from
 * `GET /v1/administrations/:id/reports/scores/students/:userId`, scoped via
 * `scopeType` + `scopeId`. Not paginated — a single resource.
 *
 * Returns the unwrapped payload (`result.body.data`):
 * `{ student, administration, tasks, completedTaskCount, totalTaskCount }`.
 * Each task carries server-computed `scores` (`rawScore` / `percentile` /
 * `standardScore`), `supportLevel`, `tags`, optional `subscores` /
 * `skillsToWorkOn`, and per-task `historicalScores` for the longitudinal trend —
 * replacing the Firestore `useUserRunPageQuery` + `useUserLongitudinalRunsQuery`
 * for the administrator-scoped report.
 *
 * This is the administrator path. The guardian/parent path is a separate
 * longitudinal endpoint (`getGuardianStudentReport`) — see its own composable.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `userId` / `scopeType` / `scopeId`; callers AND extra
 * conditions via `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} administrationId – The administration's UUID.
 * @param {import('vue').MaybeRefOrGetter<String>} userId – The student's UUID.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeId – The scoping entity's UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} Resolves to the individual-report payload.
 */
const useAdministrationIndividualScoreReportQuery = (
  administrationId,
  userId,
  scopeType,
  scopeId,
  queryOptions = undefined,
) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(administrationId)),
    () => Boolean(toValue(userId)),
    () => Boolean(toValue(scopeType)),
    () => Boolean(toValue(scopeId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_INDIVIDUAL_REPORT_QUERY_KEY, administrationId, userId, scopeType, scopeId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.scoreReports.getIndividualStudentReport({
        params: { id: toValue(administrationId), userId: toValue(userId) },
        query: {
          scopeType: toValue(scopeType),
          scopeId: toValue(scopeId),
        },
      });

      if (result.status !== StatusCodes.OK) {
        // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
        // them through `error`. The thrown shape carries the ts-rest response so
        // downstream error handlers can introspect it.
        const error = new Error(`Failed to fetch individual student report with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Unwrap the success envelope: { data: { student, administration, tasks, ... } }.
      return result.body.data;
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying delays
    // the user-facing error UX. Placed after `...options` so a caller-supplied
    // `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationIndividualScoreReportQuery;
