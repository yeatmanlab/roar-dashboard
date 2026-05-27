import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { SITE_OVERVIEW_QUERY_KEY } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';

export const useGetSiteOverviewQuery = (
  siteId: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean> = true,
) => {
  const authStore = useAuthStore();

  return useQuery({
    queryKey: computed(() => [SITE_OVERVIEW_QUERY_KEY, toValue(siteId)]),
    queryFn: () => {
      const firekit = authStore.roarfirekit;
      if (!firekit) throw new Error('Firekit not initialized');
      return firekit.getSiteOverview({ siteId: toValue(siteId) });
    },
    enabled: () => !!toValue(siteId) && authStore.isFirekitInit() && toValue(enabled),
  });
};
