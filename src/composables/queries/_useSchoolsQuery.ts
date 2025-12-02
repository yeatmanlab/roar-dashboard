import { SCHOOLS_QUERY_KEY } from '@/constants/queryKeys';
import { fetchSchools } from '@/helpers/query/orgs';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { storeToRefs } from 'pinia';
import { computed, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';

interface SchoolsQueryOptions {
  enabled?: MaybeRefOrGetter<boolean> | ComputedRef<boolean>;
}

const _useSchoolsQuery = (
  districtId?: Ref<string | null | undefined> | ComputedRef<string | null | undefined>,
  queryOptions?: SchoolsQueryOptions,
) => {
  const authStore = useAuthStore();
  const { sites } = storeToRefs(authStore);
  const { isUserSuperAdmin } = authStore;

  const siteIds = computed(() => sites?.value?.map((site) => site.siteId));
  const districts = computed(() => {
    // If districtId is provided and is not 'any', use it, otherwise use the sites from the auth store if the user is not a super admin.
    if (districtId?.value) {
      return districtId.value === 'any' ? null : [districtId.value];
    }

    return !isUserSuperAdmin() ? siteIds.value : null;
  });

  return useQuery({
    queryKey: [SCHOOLS_QUERY_KEY, districts, districtId],
    queryFn: async () => await fetchSchools(districts.value),
    ...queryOptions,
  });
};

export default _useSchoolsQuery;
