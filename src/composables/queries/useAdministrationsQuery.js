import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import _isEmpty from 'lodash/isEmpty';
import { administrationPageFetcher } from '@/helpers/query/administrations';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useUserType from '@/composables/useUserType';
import { ADMINISTRATIONS_QUERY_KEY } from '@/constants/queryKeys';

/**
 * Administrations query.
 *
 * @param {ref<String>} orderBy – A Vue ref containing the field to order the query by.
 * @param {QueryOptions|undefined} queryOptions – Optional TanStack query options.
 * @returns {UseQueryResult} The TanStack query result.
 */
const useAdministrationsQuery = (orderBy, queryOptions = undefined) => {
  // Fetch the user claims.
  const { data: userClaims } = useUserClaimsQuery({
    enabled: queryOptions?.enabled ?? true,
  });

  // Get admin status and administation orgs.
  const { isSuperAdmin } = useUserType(userClaims);
  const administrationOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);
  const exhaustiveAdministrationOrgs = computed(() => userClaims.value?.claims?.adminOrgs);

  // Ensure all necessary data is loaded before enabling the query.
  const claimsLoaded = computed(() => !_isEmpty(userClaims?.value?.claims));
  const isQueryEnabled = computed(() => claimsLoaded.value && (queryOptions?.enabled ?? true));

  // Set pagination data to fetch all administrations since pagination is not yet supported.
  const currentPage = ref(0);
  const itemsPerPage = ref(10000);

  return useQuery({
    queryKey: [ADMINISTRATIONS_QUERY_KEY, currentPage, itemsPerPage, orderBy],
    queryFn: () =>
      administrationPageFetcher(
        orderBy,
        itemsPerPage,
        currentPage,
        isSuperAdmin,
        administrationOrgs,
        exhaustiveAdministrationOrgs,
      ),
    enabled: isQueryEnabled,
    ...queryOptions,
  });
};

export default useAdministrationsQuery;
