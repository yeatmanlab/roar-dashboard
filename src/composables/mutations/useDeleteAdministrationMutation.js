import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { ADMINISTRATION_DELETE_MUTATION_KEY } from '@/constants/mutationKeys';
import {
  ADMINISTRATIONS_QUERY_KEY,
  ADMINISTRATIONS_LIST_QUERY_KEY,
  ADMINISTRATION_ASSIGNMENTS_QUERY_KEY,
} from '@/constants/queryKeys';

/**
 * Delete Administration mutation.
 *
 * TanStack mutation to delete an administration and automatically invalidate the corresponding queries.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useDeleteAdministrationMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ADMINISTRATION_DELETE_MUTATION_KEY,
    mutationFn: async (administrationId) => {
      await authStore.roarfirekit.deleteAdministration(administrationId);
    },
    onSuccess: () => {
      // Invalidate the queries to refetch the administration data.
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATIONS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMINISTRATION_ASSIGNMENTS_QUERY_KEY] });
    },
  });
};

export default useDeleteAdministrationMutation;
