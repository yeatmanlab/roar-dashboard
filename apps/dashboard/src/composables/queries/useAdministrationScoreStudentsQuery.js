import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_SCORE_STUDENTS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the student-scores request. The score report renders a
 * client-side table over the full scoped population, so the composable follows
 * the response pagination and aggregates every page into a single result
 * (mirrors `useAdministrationProgressQuery`).
 */
const STUDENT_SCORES_PER_PAGE = 100;

/**
 * Administration per-student scores query.
 *
 * Fetches per-student scores for an administration from
 * `GET /v1/administrations/:id/reports/scores/students`, scoped to a specific
 * org/class/group via `scopeType` + `scopeId`. Follows the response's pagination
 * so the full student population for the scope is returned in one composable result.
 *
 * Returns domain data `{ students, tasks, exclusions }`:
 * - `students` — `{ user, scores }` rows. `scores` is keyed by task **UUID**; each
 *   entry carries `rawScore` / `percentile` / `standardScore` / `supportLevel`
 *   (`achievedSkill` | `developingSkill` | `needsExtraSupport` | `optional` | null) /
 *   `reliable` / `engagementFlags` / `optional` / `completed`. The server computes
 *   the classification, replacing the client-side scoring in `ScoreReport.vue`.
 * - `tasks` — `{ taskId, taskSlug, taskName, orderIndex }[]` for mapping the
 *   UUID-keyed scores onto the slug-based table columns.
 * - `exclusions` — counts of records filtered from the report (e.g. rostering-ended).
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `scopeType` / `scopeId`; callers AND additional conditions
 * via `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} administrationId – The administration's UUID.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeId – The scoping entity's UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} Resolves to `{ students, tasks, exclusions }`.
 */
const useAdministrationScoreStudentsQuery = (administrationId, scopeType, scopeId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(administrationId)),
    () => Boolean(toValue(scopeType)),
    () => Boolean(toValue(scopeId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_SCORE_STUDENTS_QUERY_KEY, administrationId, scopeType, scopeId],
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
        const result = await client.administrations.scoreReports.listStudents({
          params: { id: toValue(administrationId) },
          query: {
            page,
            perPage: STUDENT_SCORES_PER_PAGE,
            scopeType: toValue(scopeType),
            scopeId: toValue(scopeId),
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
          // them through `error`. The thrown shape carries the ts-rest response so
          // downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch administration student scores with status ${result.status}`);
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

export default useAdministrationScoreStudentsQuery;
