import { ADMINS_QUERY_KEY } from '@/constants/queryKeys';
import { fetchAdminsBySite } from '@/helpers/query/administrations';
import { useQuery, UseQueryOptions, UseQueryReturnType } from '@tanstack/vue-query';
import { computed, Ref } from 'vue';

type AdminsQueryOptions = Omit<UseQueryOptions, 'queryKey' | 'queryFn'>;

const useAdminsBySiteQuery = (
  selectedSite: Ref<any>,
  queryOptions?: AdminsQueryOptions,
): UseQueryReturnType<any, Error> => {
  const siteId = computed(() => selectedSite.value?.value);
  const siteName = computed(() => selectedSite.value?.label);

  return useQuery({
    queryKey: [ADMINS_QUERY_KEY, siteId, siteName],
    queryFn: async () => await fetchAdminsBySite(siteId, siteName),
    ...queryOptions,
  });
};

export default useAdminsBySiteQuery;
