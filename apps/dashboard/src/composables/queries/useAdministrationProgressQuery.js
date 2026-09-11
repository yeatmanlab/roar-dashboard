import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_PROGRESS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the progress students request. The Progress Report renders a
 * client-side table over the full scoped population, so the composable follows
 * the response pagination and aggregates every page into a single result.
 */
const PROGRESS_STUDENTS_PER_PAGE = 100;

/**
 * Administration progress (per-student) query.
 *
 * Fetches per-student progress for an administration from
 * `GET /v1/administrations/:id/reports/progress/students`, scoped to a specific
 * org/class/group via `scopeType` + `scopeId`. Follows the response's pagination
 * so the full student population for the scope is returned in one composable result.
 *
 * Returns domain data `{ students, tasks, exclusions }`:
 * - `students` — `{ user, progress }` rows. `progress` is keyed by task UUID and
 *   each entry is one of the six visible `ProgressStatus` values with `startedAt` /
 *   `completedAt`.
 * - `tasks` — `{ taskId, taskSlug, taskName, orderIndex }[]` metadata for column rendering.
 * - `exclusions` — counts of records filtered from the report (e.g. rostering-ended).
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `scopeType` / `scopeId`; callers AND additional conditions
 * via `queryOptions.enabled`.
 *
 * @param {Ref<String>|String} administrationId – The administration's UUID.
 * @param {Ref<String>|String} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {Ref<String>|String} scopeId – The scoping entity's UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} Resolves to `{ students, tasks, exclusions }`.
 */
const useAdministrationProgressQuery = (administrationId, scopeType, scopeId, queryOptions = undefined) => {
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
    queryKey: [ADMINISTRATION_PROGRESS_QUERY_KEY, administrationId, scopeType, scopeId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const students = [];
      let tasks = [];
      let exclusions;
      let page = 1;
      let totalPages = 1;

      // Follow the response's pagination so a scope that outgrows one page is
      // fetched completely rather than silently truncated.
      do {
        const result = await client.administrations.progressReports.getStudentProgress({
          params: { id: toValue(administrationId) },
          query: {
            page,
            perPage: PROGRESS_STUDENTS_PER_PAGE,
            scopeType: toValue(scopeType),
            scopeId: toValue(scopeId),
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack
          // routes them through `error`. The thrown shape carries the ts-rest
          // response so downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch administration progress with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        // Unwrap the success envelope: { data: { tasks, items, pagination, exclusions } }.
        // tasks/exclusions are identical across pages — keep the latest.
        students.push(...result.body.data.items);
        tasks = result.body.data.tasks;
        exclusions = result.body.data.exclusions;
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return { students, tasks, exclusions };
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth errors and rostering-ended are not transient; retrying
    // delays the user-facing error UX. Placed after `...options` so a
    // caller-supplied `retry` can't silently override the policy.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error)) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationProgressQuery;
