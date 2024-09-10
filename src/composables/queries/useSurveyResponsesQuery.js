import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { fetchSubcollection } from '@/helpers/query/utils';
import { SURVEY_RESPONSES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Survey responses query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useSurveyResponsesQuery = (queryOptions = undefined) => {
  const authStore = useAuthStore();
  const { uid } = storeToRefs(authStore);

  const isQueryEnabled = computed(() => {
    const enabled = queryOptions?.enabled;
    return !!uid.value && (enabled === undefined ? true : enabled);
  });

  const options = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return useQuery({
    queryKey: [SURVEY_RESPONSES_QUERY_KEY],
    queryFn: () => fetchSubcollection(`${FIRESTORE_COLLECTIONS.USERS}/${uid.value}`, 'surveyResponses'),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useSurveyResponsesQuery;
