import { toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { StatusCodes } from 'http-status-codes';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { getRoarApiClient } from '@/clients/roar-api';
import { useAuthStore } from '@/store/auth';
import { isRosteringEndedError, isTerminalAuthError } from '@/utils/api-errors';
import { TASK_VARIANT_QUERY_KEY } from '@/constants/queryKeys';

const MAX_RETRIES = 3;

/**
 * Single task-variant query.
 *
 * Fetches one task variant — including its `parameters` — from the backend
 * `GET /tasks/:taskId/variants/:variantId` endpoint. Intended for lazy,
 * on-demand use (for example, revealing a variant's parameters when a super
 * admin opens a details popover), so it stays disabled until both ids are set.
 *
 * **Enablement.** Gated internally on `authStore.accessToken` and on both
 * `taskId` and `variantId` being present. Callers can pass `queryOptions.enabled`
 * to add conditions; `computeQueryOverrides` AND's them together.
 *
 * @param {import('vue').MaybeRefOrGetter<string>} taskId – Task UUID or slug.
 * @param {import('vue').MaybeRefOrGetter<string>} variantId – Variant UUID.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result resolving to the task variant.
 */
const useTaskVariantQuery = (taskId, variantId, queryOptions = undefined) => {
  const authStore = useAuthStore();
  const conditions = [
    () => Boolean(authStore.accessToken),
    () => Boolean(toValue(taskId)),
    () => Boolean(toValue(variantId)),
  ];
  const { isQueryEnabled, options } = computeQueryOverrides(conditions, queryOptions);

  return useQuery({
    queryKey: [TASK_VARIANT_QUERY_KEY, taskId, variantId],
    queryFn: async () => {
      const client = getRoarApiClient();
      const result = await client.tasks.getTaskVariant({
        params: { taskId: toValue(taskId), variantId: toValue(variantId) },
      });

      if (result.status !== StatusCodes.OK) {
        const error = new Error(`Failed to fetch task variant with status ${result.status}`);
        error.status = result.status;
        error.body = result.body;
        throw error;
      }

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

export default useTaskVariantQuery;
