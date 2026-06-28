import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { USER_GUARDIAN_REPORT_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Guardian (parent) student-report query — the longitudinal/parent path.
 *
 * Fetches a single student's complete score history across all administrations
 * from `GET /v1/users/:userId/reports/scores`. Unlike the administrator-scoped
 * individual report, this endpoint is **not** scoped to an org/administration —
 * authorization is the guardian → child link — so it takes no scope params and
 * returns every administration the student has started, completed, or remains
 * assigned to.
 *
 * Returns the unwrapped payload (`result.body.data`):
 * `{ student, administrations, longitudinalScores }`:
 * - `administrations` — `{ administrationId, name, dateStart, dateEnd, tasks }[]`,
 *   each task carrying the same computed per-task shape as the admin report minus
 *   the per-task `historicalScores`.
 * - `longitudinalScores` — `Record<taskSlug, HistoricalScore[]>` for trend rendering
 *   (the per-administration tasks omit `historicalScores`; it lives here instead).
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND a truthy
 * `userId`; callers AND extra conditions via `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} userId – The student's UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} Resolves to `{ student, administrations, longitudinalScores }`.
 */
const useGuardianStudentReportQuery = (userId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => Boolean(toValue(userId))];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [USER_GUARDIAN_REPORT_QUERY_KEY, userId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.users.scoreReports.getGuardianStudentReport({
        params: { userId: toValue(userId) },
      });

      if (result.status !== StatusCodes.OK) {
        // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
        // them through `error`. The thrown shape carries the ts-rest response so
        // downstream error handlers can introspect it.
        const error = new Error(`Failed to fetch guardian student report with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Unwrap the success envelope: { data: { student, administrations, longitudinalScores } }.
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

export default useGuardianStudentReportQuery;
