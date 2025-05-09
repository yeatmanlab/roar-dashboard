import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { variantsFetcher } from '@/helpers/query/tasks';
import { TASK_VARIANTS_QUERY_KEY } from '@/constants/queryKeys';
import { TOGGLE_REGISTERED_VARIANTS_MUTATION_KEY } from '@/constants/mutationKeys';

/**
 * Toggle registered variants mutation
 *
 * Tanstack query to invalidate variants query after mutation
 * Used to toggle registered variants when updating tasks using the ManageVariants component
 * @param {*} registeredVariantsOnly
 * @returns
 */
const useToggleRegisteredVariantsMutation = (registeredVariantsOnly) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [TOGGLE_REGISTERED_VARIANTS_MUTATION_KEY],
    mutationFn: () => variantsFetcher(registeredVariantsOnly),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY, 'registered'] });
      queryClient.invalidateQueries({ queryKey: [TASK_VARIANTS_QUERY_KEY] });
    },
  });
};

export default useToggleRegisteredVariantsMutation;
