import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { ADMINISTRATION_SCORE_FACETS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Administration score-distribution-facets query.
 *
 * Fetches per-task support-level and score-bin distributions, faceted by grade
 * and school, from `GET /v1/administrations/:id/reports/scores/facets`, scoped to
 * a specific org/class/group via `scopeType` + `scopeId`. Not paginated — the
 * endpoint aggregates across the full population in scope, so this is a single
 * request (like the overview endpoint).
 *
 * Returns the unwrapped payload (`result.body.data`): `{ totalStudents, tasks,
 * computedAt }` where each task carries `supportLevelByGrade` /
 * `supportLevelBySchool` and `scoreBinsByGrade` / `scoreBinsBySchool`. The
 * school-faceted arrays are empty at non-district scope (the school-facet toggle
 * is district-only). This replaces the client-side facet binning over runs and
 * the Firestore `useDistrictSupportCategoriesQuery` for the distribution charts.
 *
 * **Enablement.** Internally gated on `authStore.accessToken` AND truthy
 * `administrationId` / `scopeType` / `scopeId`; callers AND extra conditions via
 * `queryOptions.enabled`.
 *
 * @param {import('vue').MaybeRefOrGetter<String>} administrationId – The administration's UUID.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeType – 'district' | 'school' | 'class' | 'group'.
 * @param {import('vue').MaybeRefOrGetter<String>} scopeId – The scoping entity's UUID.
 * @param {Object|undefined} queryOptions – Optional TanStack query options.
 * @returns {import('@tanstack/vue-query').UseQueryReturnType} Resolves to `{ totalStudents, tasks, computedAt }`.
 */
const useAdministrationScoreFacetsQuery = (administrationId, scopeType, scopeId, queryOptions = undefined) => {
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
    queryKey: [ADMINISTRATION_SCORE_FACETS_QUERY_KEY, administrationId, scopeType, scopeId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.administrations.scoreReports.getScoreFacets({
        params: { id: toValue(administrationId) },
        query: {
          scopeType: toValue(scopeType),
          scopeId: toValue(scopeId),
        },
      });

      if (result.status !== StatusCodes.OK) {
        // Non-200 ts-rest results are surfaced as thrown errors so TanStack routes
        // them through `error`. The thrown shape carries the ts-rest response so
        // downstream error handlers can introspect it.
        const error = new Error(`Failed to fetch administration score facets with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

      // Unwrap the success envelope: { data: { totalStudents, tasks, computedAt } }.
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

export default useAdministrationScoreFacetsQuery;
