import { ADMINS_QUERY_KEY } from '@/constants/queryKeys';
import { fetchAdminsBySite } from '@/helpers/query/administrations';
import { useQuery, UseQueryOptions, UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';

type AdminsQueryOptions = Omit<UseQueryOptions, 'queryKey' | 'queryFn'>;

const useAdminsBySiteQuery = (queryOptions?: AdminsQueryOptions): UseQueryReturnType<any, Error> => {
  const authStore = useAuthStore();
  const { currentSite, currentSiteName } = storeToRefs(authStore);

  const isQueryEnabled = computed(() => {
    if (currentSite.value === 'any') return true;
    return Boolean(currentSite.value && currentSiteName.value);
  });

  return useQuery({
    queryKey: [ADMINS_QUERY_KEY, currentSite, currentSiteName],
    queryFn: async () => await fetchAdminsBySite(currentSite, currentSiteName),
    enabled: isQueryEnabled,
    ...queryOptions,
  });
};

export default useAdminsBySiteQuery;
