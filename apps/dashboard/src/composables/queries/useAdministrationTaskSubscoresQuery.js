import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_TASK_SUBSCORES_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Page size for the task-subscores request. The subscore table renders the full
 * scoped population client-side, so the composable follows the response
 * pagination and aggregates every page into a single result (mirrors
 * `useAdministrationScoreStudentsQuery`).
 */
const SUBSCORES_PER_PAGE = 100;

/**
 * Administration per-task subscores query.
 *
 * Fetches per-student subscore rows for a single task from
 * `GET /v1/administrations/:id/reports/scores/tasks/:taskId`, scoped via
 * `scopeType` + `scopeId`. Follows the response's pagination so the full
 * population for the scope is returned in one composable result.
 *
 * Returns `{ task, subscoreColumns, students, pagination }`:
 * - `subscoreColumns` — `{ key, label }[]` declaring the task's subscore columns;
 *   the frontend renders headers from this instead of hard-coding column lists
 *   per task slug.
 * - `students` — `{ user, subscores }` rows. `subscores` is keyed by the
 *   `subscoreColumns[].key` values; each value is a string (`"15/19"` / comma
 *   lists), a number (percent / total / raw), or null.
 * - `task` — `{ taskId, taskSlug, taskName, orderIndex }` metadata.
 *
 * Tasks with no registered subscore schema (e.g. SWR, SRE) return **400** — the
 * caller should only render a subscore table for tasks that have one. A 400 is
 * treated as terminal (not retried).
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `taskId` / `scopeType` / `scopeId`; callers AND extra
 * conditions via `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} administrationId – The administration's UUID.
 * @param {import('vue').MaybeRefOrGetter<String>} taskId – The task's UUID (not the slug).
 * @param {import('vue').MaybeRefOrGetter<String>} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeId – The scoping entity's UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} Resolves to `{ task, subscoreColumns, students, pagination }`.
 */
const useAdministrationTaskSubscoresQuery = (
  administrationId,
  taskId,
  scopeType,
  scopeId,
  queryOptions = undefined,
) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(administrationId)),
    () => Boolean(toValue(taskId)),
    () => Boolean(toValue(scopeType)),
    () => Boolean(toValue(scopeId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [ADMINISTRATION_TASK_SUBSCORES_QUERY_KEY, administrationId, taskId, scopeType, scopeId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const students = [];
      let task;
      let subscoreColumns = [];
      let pagination;
      let page = 1;
      let totalPages = 1;

      // Follow the response's pagination so a scope that outgrows one page is
      // fetched completely rather than silently truncated.
      do {
        const result = await client.administrations.scoreReports.listTaskSubscores({
          params: { id: toValue(administrationId), taskId: toValue(taskId) },
          query: {
            page,
            perPage: SUBSCORES_PER_PAGE,
            scopeType: toValue(scopeType),
            scopeId: toValue(scopeId),
          },
        });

        if (result.status !== StatusCodes.OK) {
          // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
          // them through `error`. The thrown shape carries the ts-rest response so
          // downstream error handlers can introspect it.
          const error = new Error(`Failed to fetch task subscores with status ${result.status}`);
          error.status = result.status;
          error.body = result.body;
          throw error;
        }

        // Unwrap the success envelope: { data: { task, subscoreColumns, items, pagination } }.
        // task/subscoreColumns are identical across pages — keep the latest.
        students.push(...result.body.data.items);
        task = result.body.data.task;
        subscoreColumns = result.body.data.subscoreColumns;
        pagination = result.body.data.pagination;
        totalPages = result.body.data.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      return { task, subscoreColumns, students, pagination };
    },
    ...options,
    enabled: isQueryEnabled,
    // Terminal auth, rostering-ended, and 400 (task has no subscore schema /
    // invalid request) are not transient — retrying just delays the error UX.
    // Placed after `...options` so a caller-supplied `retry` can't override it.
    retry: (failureCount, error) => {
      if (isRosteringEndedError(error) || isTerminalAuthError(error) || error?.status === StatusCodes.BAD_REQUEST) {
        return false;
      }
      return failureCount < MAX_RETRIES;
    },
  });
};

export default useAdministrationTaskSubscoresQuery;
