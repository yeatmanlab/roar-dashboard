<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="isLoading" class="my-4 flex flex-col w-full items-center justify-center">
        <AppSpinner class="my-4" />
        <div class="text-sm font-light text-gray-600 uppercase">Loading Progress Datatable</div>
      </div>

      <template v-else>
        <ProgressReportHeader
          :org-type="props.orgType"
          :org-name="orgData?.name"
          :administration-name="displayName"
          :report-view="reportView"
          :report-views="REPORT_VIEWS"
          @view-change="handleViewChange"
        />

        <div v-if="assignmentData?.length">
          <ProgressStatsOverview
            v-if="adminStats"
            :admin-stats="adminStats"
            :administration-data="administrationData"
            :tasks-dictionary="tasksDictionary"
          />

          <RoarDataTable
            v-if="progressReportColumns?.length ?? 0 > 0"
            :data="filteredTableData"
            :columns="progressReportColumns"
            :total-records="filteredTableData?.length"
            :loading="isLoadingAssignments || isFetchingAssignments"
            :page-limit="pageLimit"
            :allow-filtering="true"
            :reset-filters="resetFilters"
            :lazy-pre-sorting="orderBy"
            @export-selected="exportSelected"
            @export-all="exportAll"
          />
        </div>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import useUserType from '@/composables/useUserType';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useAdministrationsStatsQuery from '@/composables/queries/useAdministrationsStatsQuery';
import useOrgQuery from '@/composables/queries/useOrgQuery';
import useDistrictSchoolsQuery from '@/composables/queries/useDistrictSchoolsQuery';
import useAdministrationAssignmentsQuery from '@/composables/queries/useAdministrationAssignmentsQuery';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { getDynamicRouterPath } from '@/helpers/getDynamicRouterPath';
import { getTitle } from '@/helpers/query/administrations';
import { APP_ROUTES } from '@/constants/routes';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import RoarDataTable from '@/components/RoarDataTable';
import { ProgressReportHeader, ProgressStatsOverview } from './components';
import { useProgressData, useProgressColumns, useProgressExport, useProgressFilters } from './composables';
import {
  REPORT_VIEWS,
  DEFAULT_ORDER_BY,
  DISTRICT_ORDER_BY_PREFIX,
  DEFAULT_PAGE_LIMIT,
} from './constants/progressReportConstants';

const router = useRouter();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const props = defineProps({
  administrationId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
});

const initialized = ref(false);
const reportView = ref(REPORT_VIEWS[0]);
const pageLimit = ref(DEFAULT_PAGE_LIMIT);

// Setup order by based on org type
const orderBy = ref(
  props.orgType === 'district' ? [DISTRICT_ORDER_BY_PREFIX, ...DEFAULT_ORDER_BY] : [...DEFAULT_ORDER_BY],
);

// Queries
const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);

const { data: administrationData } = useAdministrationsQuery([props.administrationId], {
  enabled: initialized,
  select: (data) => data[0],
});

const { data: adminStats } = useAdministrationsStatsQuery([props.administrationId], props.orgId, {
  enabled: initialized,
  select: (data) => data[0],
});

const { data: districtSchoolsData } = useDistrictSchoolsQuery(props.orgId, {
  enabled: props.orgType === SINGULAR_ORG_TYPES.DISTRICTS && initialized,
});

const { data: orgData } = useOrgQuery(props.orgType, [props.orgId], {
  enabled: initialized,
  select: (data) => data[0],
});

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: assignmentData,
} = useAdministrationAssignmentsQuery(props.administrationId, props.orgType, props.orgId, {
  enabled: initialized,
});

// Computed values
const isLoading = computed(() => isLoadingAssignments.value || isLoadingTasksDictionary.value);

const displayName = computed(() => {
  if (administrationData.value) {
    return getTitle(administrationData.value, isSuperAdmin.value);
  }
  return '';
});

const schoolNameDictionary = computed(() => {
  if (districtSchoolsData.value) {
    return districtSchoolsData.value.reduce((acc, school) => {
      acc[school.id] = school.name;
      return acc;
    }, {});
  }
  return {};
});

// Composables
const { computedProgressData } = useProgressData(assignmentData, schoolNameDictionary);

const { progressReportColumns } = useProgressColumns(
  administrationData,
  assignmentData,
  tasksDictionary,
  districtSchoolsData,
  authStore,
  props.orgType,
  isLoadingTasksDictionary,
);

const { exportSelected, exportAll } = useProgressExport(
  computedProgressData,
  tasksDictionary,
  administrationData,
  orgData,
  displayName,
  authStore,
  props.orgType,
);

const { filteredTableData, resetFilters } = useProgressFilters(computedProgressData);

// Handlers
const handleViewChange = () => {
  const { administrationId, orgType, orgId } = props;
  router.push({ path: getDynamicRouterPath(APP_ROUTES.SCORE_REPORT, { administrationId, orgType, orgId }) });
};

// Initialization
let unsubscribe;
const refreshing = ref(false);
const refresh = () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();
  refreshing.value = false;
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig?.()) refresh();
});
</script>
