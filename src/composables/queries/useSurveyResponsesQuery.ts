import { type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryReturnType, type UseQueryOptions } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { fetchSubcollection } from '@/helpers/query/utils';
import { computeQueryOverrides } from '@/helpers/computeQueryOverrides';
import { SURVEY_RESPONSES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * Survey responses query.
 *
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useSurveyResponsesQuery = (queryOptions?: UseQueryOptions): UseQueryReturnType => {
  const authStore = useAuthStore();
  const { roarUid } = storeToRefs(authStore);

  const queryConditions = [() => !!roarUid.value];
  const { isQueryEnabled, options } = computeQueryOverrides(queryConditions, queryOptions);

  return useQuery({
    queryKey: [SURVEY_RESPONSES_QUERY_KEY],
    queryFn: () => fetchSubcollection(`${FIRESTORE_COLLECTIONS.USERS}/${roarUid.value}`, 'surveyResponses'),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useSurveyResponsesQuery;
