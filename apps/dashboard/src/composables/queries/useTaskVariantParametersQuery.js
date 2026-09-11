import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { hasArrayEntries } from '@/helpers/hasArrayEntries';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_VARIANT_PARAMETERS_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Task-variant parameters (by variant ID) query.
 *
 * Fetches one or more task variants — including their `parameters` — from the
 * backend `GET /task-variants/:variantId` endpoint (`getByIdWithTaskDetails`),
 * one request per id via `Promise.all`. Unlike `GET /tasks/:taskId/variants/:variantId`
 * (`useTaskVariantQuery`), this endpoint takes only the variant ID (no task ID
 * lookup needed) and has no published-only restriction for non-super-admins, so
 * it also resolves parameters for variants an administration used historically
 * even if the variant has since been deprecated.
 *
 * There's no bulk-by-ids endpoint open to non-admins (the cross-task
 * `GET /task-variants` list requires super admin / platform administrator), so
 * this fans out — bounded by the small, fixed number of task variants per
 * administration, not by student count.
 *
 * Each resolved item has the shape `{ id, taskId, taskSlug, ..., parameters: [{ name, value }] }`.
 *
 * All-or-nothing: a non-200 for any id rejects the whole query.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` (for the API
 * call) and on `variantIds` having entries.
 *
 * @param {import('vue').MaybeRefOrGetter<Array<string>>} variantIds – Task variant UUIDs.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the array of variants with parameters.
 */
const useTaskVariantParametersQuery = (variantIds, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [() => Boolean(authStore.accessToken), () => hasArrayEntries(variantIds)];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_VARIANT_PARAMETERS_QUERY_KEY, variantIds],
    queryFn: async () => {
      const client = getRoarApiClient();
      const ids = toValue(variantIds) ?? [];

      // One request per id via Promise.all. All-or-nothing: a non-200 for any id
      // rejects the whole query — acceptable since the ids come from the
      // administration's own task-variants list, so a failure here means a real
      // data-consistency problem, not a missing/inaccessible id to tolerate.
      return Promise.all(
        ids.map(async (variantId) => {
          const result = await client.taskVariants.getByIdWithTaskDetails({ params: { variantId } });

          if (result.status !== StatusCodes.OK) {
            const error = new Error(`Failed to fetch task variant ${variantId} with status ${result.status}`);
            error.status = result.status;
            error.body = result.body;
            throw error;
          }

          return result.body.data;
        }),
      );
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

export default useTaskVariantParametersQuery;
