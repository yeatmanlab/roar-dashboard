import { DISTRICTS_QUERY_KEY } from '@/constants/queryKeys';
import { fetchDistricts } from '@/helpers/query/orgs';
import { useAuthStore } from '@/store/auth';
import { useQuery, UseQueryOptions } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

const _useDistrictsQuery = (queryOptions?: UseQueryOptions) => {
  const authStore = useAuthStore();
  const { sites } = storeToRefs(authStore);
  const { isUserSuperAdmin } = authStore;

  // If districts are not provided, fetch all districts for the user.
  const districts = computed(() => (!isUserSuperAdmin() ? sites.value : null));

  return useQuery({
    queryKey: [DISTRICTS_QUERY_KEY, districts],
    queryFn: async () => await fetchDistricts(districts.value),
    ...queryOptions,
  });
};

export default _useDistrictsQuery;
