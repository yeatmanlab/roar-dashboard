import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { fetchSubcollection } from '@/helpers/query/utils';

/**
 * Survey responses composable.
 *
 * @returns {Object} Object containing survey responses data.
 */
const useSurveyResponsesQuery = (queryOptions = undefined, enabled) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  return useQuery({
    queryKey: ['surveyResponses', uid],
    queryFn: () => fetchSubcollection(`users/${uid.value}`, 'surveyResponses'),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000,
    ...queryOptions,
  });
};

export default useSurveyResponsesQuery;
