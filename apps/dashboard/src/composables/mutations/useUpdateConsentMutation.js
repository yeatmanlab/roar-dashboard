import { toValue } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { CONSENT_UPDATE_MUTATION_KEY } from '@/constants/mutationKeys';
import { USER_DATA_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Consent Update mutation.
 *
 * TanStack mutation to update consent status and automatically invalidate the corresponding queries.
 *
 * @returns {Object} The mutation object returned by `useMutation`.
 */
const useUpdateConsentMutation = () => {
  const authStore = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: CONSENT_UPDATE_MUTATION_KEY,
    mutationFn: async (data) => {
      const consentType = toValue(data.consentType);
      const consentVersion = toValue(data.consentVersion);
      const consentParams = toValue(data.consentParams) || {};

      await authStore.roarfirekit.updateConsentStatus(consentType, consentVersion, consentParams);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_DATA_QUERY_KEY] });
    },
  });
};

export default useUpdateConsentMutation;
