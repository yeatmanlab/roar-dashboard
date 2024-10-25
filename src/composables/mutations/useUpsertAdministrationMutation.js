import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { ADMINISTRATION_UPSERT_MUTATION_KEY } from '@/constants/mutationKeys';
import {
  ADMINISTRATIONS_QUERY_KEY,
  ADMINISTRATIONS_LIST_QUERY_KEY,
  ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
} from '@/constants/queryKeys';

/**
 * Upsert Administration mutation.
 *
 * TanStack mutation to update or insert an administration and automatically invalidate the corresponding queries.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpsertAdministrationMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ADMINISTRATION_UPSERT_MUTATION_KEY,
    mutationFn: async (data) => {
      await authStore.roarfirekit.createAdministration(data);
    },
    onSuccess: () => {
      // Invalidate the queries to refetch the administration data.
      // @NOTE: Usually we would apply a more granular invalidation strategy including updating the specific
      // adminitration record in the cache. However, unfortunately, given the nature of the data model and the data that
      // is updated in the application, we would have to manually map the updated data, which could cause issues when
      // the data model changes. Therefore, we invalidate the entire query to ensure the data is up-to-date.
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY] });
    },
  });
};

export default useUpsertAdministrationMutation;
