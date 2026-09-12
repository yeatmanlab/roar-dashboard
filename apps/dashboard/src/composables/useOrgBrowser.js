import { computed, ref, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import useDistrictsListQuery from '@/composables/queries/useDistrictsListQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useSchoolClassesQuery from '@/composables/queries/useSchoolClassesQuery';
import useGroupsListQuery from '@/composables/queries/useGroupsListQuery';
import { ORG_TYPES } from '@/constants/orgTypes';

/**
 * Organization tabs and cascading selectors shared by OrgPicker and OrgsList.
 * All tabs remain reachable; the backend determines their accessible contents.
 *
 * @returns {object} Tab selection, backend query data, and active-tab request state.
 */
export default function useOrgBrowser() {
  const authStore = useAuthStore();
  const orgHeaders = [
    { id: ORG_TYPES.DISTRICTS, header: 'Districts' },
    { id: ORG_TYPES.SCHOOLS, header: 'Schools' },
    { id: ORG_TYPES.CLASSES, header: 'Classes' },
    { id: ORG_TYPES.GROUPS, header: 'Groups' },
  ];
  const activeIndex = ref(0);
  const activeOrgType = computed(() => orgHeaders[activeIndex.value].id);
  const selectedDistrict = ref();
  const selectedSchool = ref();
  const districts = useDistrictsListQuery();
  const schools = useDistrictSchoolsQuery(selectedDistrict);
  const classes = useSchoolClassesQuery(selectedSchool);
  const groups = useGroupsListQuery({
    enabled: computed(() => activeOrgType.value === ORG_TYPES.GROUPS),
  });

  // Select from cached data on mount too, and preserve a valid selection on refetch.
  watch(
    districts.data,
    (orgs) => {
      if (!orgs?.some((org) => org.id === selectedDistrict.value)) selectedDistrict.value = orgs?.[0]?.id;
    },
    { immediate: true },
  );
  watch(
    selectedDistrict,
    () => {
      selectedSchool.value = undefined;
    },
    { flush: 'sync' },
  );
  watch(
    schools.data,
    (orgs) => {
      if (!orgs?.some((org) => org.id === selectedSchool.value)) selectedSchool.value = orgs?.[0]?.id;
    },
    { immediate: true },
  );

  const activeQueries = computed(() => {
    switch (activeOrgType.value) {
      case ORG_TYPES.SCHOOLS:
        return [districts, schools];
      case ORG_TYPES.CLASSES:
        return [districts, schools, classes];
      case ORG_TYPES.GROUPS:
        return [groups];
      default:
        return [districts];
    }
  });
  const orgData = computed(() => activeQueries.value.at(-1).data.value ?? []);
  // Include parent requests: a failed district lookup must not look like empty schools.
  const error = computed(() => activeQueries.value.find((query) => query.error.value)?.error.value);
  const isLoading = computed(
    () => !authStore.isAuthReady || activeQueries.value.some((query) => query.isLoading.value),
  );
  const isFetching = computed(() => activeQueries.value.some((query) => query.isFetching.value));
  const retry = () =>
    Promise.all(activeQueries.value.filter((query) => query.error.value).map((query) => query.refetch()));

  return {
    orgHeaders,
    activeIndex,
    activeOrgType,
    selectedDistrict,
    selectedSchool,
    orgData,
    allDistricts: districts.data,
    allSchools: schools.data,
    isLoadingDistricts: districts.isLoading,
    isLoadingSchools: schools.isLoading,
    isLoading,
    isFetching,
    error,
    retry,
  };
}
