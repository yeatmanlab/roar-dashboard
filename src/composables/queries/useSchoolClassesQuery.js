import { computed, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { orgFetcher } from '@/helpers/query/orgs';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { SCHOOL_CLASSES_QUERY_KEY } from '@/constants/queryKeys';
import { FIRESTORE_COLLECTIONS } from '@/constants/firebase';

/**
 * School Classes query.
 *
 * Query designed to fetch the classes of a given school.
 *
 * @param {Ref<String>} schoolId – A Vue ref containing the ID of the school to fetch classes for.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useSchoolClassesQuery = (schoolId, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  const { isSuperAdmin } = useUserType(userClaims);
  const administrationOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const isQueryEnabled = computed(() => {
    const enabled = queryOptions?.enabled;
    return !!toValue(schoolId) && claimsLoaded.value && (enabled === undefined ? true : enabled);
  });

  // Remove the enabled property from the query options to avoid overriding the computed value.
  const options = queryOptions ? { ...queryOptions } : {};
  delete options.enabled;

  return useQuery({
    queryKey: [SCHOOL_CLASSES_QUERY_KEY, schoolId],
    queryFn: () => orgFetcher(FIRESTORE_COLLECTIONS.CLASSES, schoolId, isSuperAdmin, administrationOrgs),
    enabled: isQueryEnabled,
    ...options,
  });
};

export default useSchoolClassesQuery;
