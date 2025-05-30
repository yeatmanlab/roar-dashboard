<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="isLoading" class="loading-wrapper">
        <AppSpinner style="margin: 1rem 0rem" />
        <div class="uppercase text-sm text-gray-600 font-light">Loading Progress Datatable</div>
      </div>

      <template v-else>
        <div class="flex justify-content-between align-items-center">
          <div class="flex flex-column align-items-start mb-4 gap-2">
            <div>
              <div class="uppercase font-light text-gray-500 text-md">{{ props.orgType }} Progress Report</div>
              <div class="report-title uppercase">
                {{ orgData?.name }}
              </div>
            </div>
            <div>
              <div class="uppercase font-light text-gray-500 text-md">Administration</div>
              <div class="administration-name uppercase">
                {{ displayName }}
              </div>
            </div>
          </div>
          <div class="flex flex-row align-items-center gap-4">
            <div class="uppercase text-sm text-gray-600">VIEW</div>
            <PvSelectButton
              v-model="reportView"
              v-tooltip.top="'View different report'"
              :options="reportViews"
              option-disabled="constant"
              :allow-empty="false"
              option-label="name"
              class="flex my-2 select-button"
              @change="handleViewChange"
            >
            </PvSelectButton>
          </div>
        </div>

        <div v-if="assignmentData?.length">
          <div
            v-if="adminStats != null"
            class="flex flex-column align-items-around flex-wrap gap-3 rounded bg-gray-100 p-5"
          >
            <div class="flex flex-column gap-1 mx-5 mb-5">
              <div class="text-sm uppercase text-gray-500">Progress by Assessment</div>
              <div
                v-for="{ taskId } of administrationData.assessments"
                :key="taskId"
                class="flex justify-content-between align-items-center"
              >
                <div v-if="tasksDictionary[taskId]" class="text-lg font-bold text-gray-600 w-full">
                  {{ tasksDictionary[taskId]?.technicalName ?? taskId }}
                  <span v-if="tasksDictionary[taskId].name" class="font-light uppercase text-sm">
                    ({{ tasksDictionary[taskId]?.publicName }})
                  </span>
                </div>
                <div v-else class="text-lg font-bold text-gray-600 w-full">
                  {{ taskId }}
                </div>
                <PvChart
                  type="bar"
                  :data="setBarChartData(adminStats[taskId])"
                  :options="setBarChartOptions(adminStats[taskId])"
                  class="h-2rem lg:w-full"
                />
              </div>
            </div>
            <div class="flex flex-column mx-5">
              <div class="text-sm uppercase text-gray-500">Total Assessment Progress</div>
              <div class="flex justify-content-between align-items-center">
                <div class="text-xl font-bold text-gray-600 w-full">
                  Total
                  <span class="font-light text-sm"> ({{ adminStats.assignment.assigned }} total assignments) </span>
                </div>
                <PvChart
                  type="bar"
                  :data="setBarChartData(adminStats.assignment)"
                  :options="setBarChartOptions(adminStats.assignment)"
                  class="h-3rem lg:w-full"
                />
              </div>
            </div>
            <div class="flex flex-column align-items-center mx-5">
              <div class="flex flex-wrap justify-content-around align-items-center px-2 py-1 rounded">
                <div class="legend-entry">
                  <div class="circle" style="background-color: var(--bright-green)" />
                  <div>
                    <div>Completed</div>
                  </div>
                </div>
                <div class="legend-entry">
                  <div class="circle" style="background-color: var(--yellow-100)" />
                  <div>
                    <div>Started</div>
                  </div>
                </div>
                <div class="legend-entry">
                  <div class="circle" style="background-color: var(--surface-d)" />
                  <div>
                    <div>Assigned</div>
                  </div>
                </div>
              </div>
              <div class="font-light uppercase text-xs text-gray-500 my-1">Legend</div>
            </div>
          </div>
          <RoarDataTable
            v-if="progressReportColumns?.length ?? 0 > 0"
            :data="filteredTableData"
            :columns="progressReportColumns"
            :total-records="filteredTableData?.length"
            :loading="isLoadingAssignments || isFetchingAssignments"
            :page-limit="pageLimit"
            data-cy="roar-data-table"
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
import { computed, ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import _map from 'lodash/map';
import PvChart from 'primevue/chart';
import PvSelectButton from 'primevue/selectbutton';
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
import { exportCsv } from '@/helpers/query/utils';
import { taskDisplayNames } from '@/helpers/reports.js';
import { getTitle } from '@/helpers/query/administrations';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import { APP_ROUTES } from '@/constants/routes';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import { usePermissions } from '@/composables/usePermissions';
import { Permissions } from '@bdelab/roar-firekit';
import RoarDataTable from '@/components/RoarDataTable';

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

const isLoading = computed(() => isLoadingAssignments.value || isLoadingTasksDictionary.value);

const reportView = ref({ name: 'Progress Report', constant: true });
const reportViews = [
  { name: 'Progress Report', constant: true },
  { name: 'Score Report', constant: false },
];

const displayName = computed(() => {
  if (administrationData.value) {
    return getTitle(administrationData.value, isSuperAdmin.value);
  }
  return '';
});

const handleViewChange = () => {
  const { administrationId, orgType, orgId } = props;
  router.push({ path: getDynamicRouterPath(APP_ROUTES.SCORE_REPORT, { administrationId, orgType, orgId }) });
};

const orderBy = ref([
  {
    order: '1',
    field: 'user.grade',
  },
  {
    order: '1',
    field: 'user.lastName',
  },
]);

// If this is a district report, make the schools column first sorted.
if (props.orgType === 'district') {
  orderBy.value.unshift({
    order: '1',
    field: 'user.schoolName',
  });
}

const filterSchools = ref([]);
const filterGrades = ref([]);
const pageLimit = ref(10);

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

const schoolNameDictionary = computed(() => {
  if (districtSchoolsData.value) {
    return districtSchoolsData.value.reduce((acc, school) => {
      acc[school.id] = school.name;
      return acc;
    }, {});
  } else {
    return {};
  }
});

const computedProgressData = computed(() => {
  if (!assignmentData.value) return [];
  // assignmentTableData is an array of objects, each representing a row in the table
  const assignmentTableDataAcc = [];

  for (const { assignment, user } of assignmentData.value) {
    // for each row, compute: username, firstName, lastName, assessmentPID, grade, school, all the scores, and routeParams for report link
    const grade = user.studentData?.grade;
    // compute schoolName
    let schoolName = '';
    const schoolId = user?.schools?.current[0];
    if (schoolId) {
      schoolName = schoolNameDictionary.value[schoolId];
    }
    const currRow = {
      user: {
        username: user.username,
        email: user.email,
        userId: user.userId,
        firstName: user.name?.first,
        lastName: user.name?.last,
        grade: grade,
        assessmentPid: user.assessmentPid,
        schoolName: schoolName,
      },
      routeParams: {
        userId: user.userId,
      },
      launchTooltip: `View assessment portal for ${user.name?.first || user.username}`,
      // compute and add progress data in next step
    };

    const currRowProgress = {};
    for (const assessment of assignment.assessments) {
      // General Logic to grab support level, scores, etc
      let progressFilterTags = '';
      const taskId = assessment.taskId;

      if (assessment?.optional) {
        currRowProgress[taskId] = {
          value: 'optional',
          icon: 'pi pi-question',
          severity: 'info',
        };
        progressFilterTags += ' Optional ';
      } else if (assessment?.completedOn !== undefined) {
        currRowProgress[taskId] = {
          value: 'completed',
          icon: 'pi pi-check',
          severity: 'success',
        };
        progressFilterTags += ' Completed ';
      } else if (assessment?.startedOn !== undefined) {
        currRowProgress[taskId] = {
          value: 'started',
          icon: 'pi pi-spinner-dotted',
          severity: 'warning',
        };
        progressFilterTags += ' Started ';
      } else {
        currRowProgress[taskId] = {
          value: 'assigned',
          icon: 'pi pi-book',
          severity: 'danger',
        };
        progressFilterTags += ' Assigned ';
      }
      currRowProgress[taskId].tags = progressFilterTags;

      // update progress for current row with computed object
      currRow.progress = currRowProgress;
      // push currRow to assignmentTableDataAcc
    }
    assignmentTableDataAcc.push(currRow);
  }

  return assignmentTableDataAcc;
});

const resetFilters = () => {
  filterSchools.value = [];
  filterGrades.value = [];
};

const exportSelected = (selectedRows) => {
  const computedExportData = _map(selectedRows, ({ user, progress }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      tableRow['School'] = _get(user, 'schoolName');
    }
    for (const taskId in progress) {
      tableRow[tasksDictionary.value[taskId]?.publicName ?? taskId] = progress[taskId].value;
    }
    return tableRow;
  });
  exportCsv(computedExportData, 'roar-progress-selected.csv');
  return;
};

const exportAll = async () => {
  const computedExportData = _map(computedProgressData.value, ({ user, progress }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      Email: _get(user, 'email'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      tableRow['School'] = _get(user, 'schoolName');
    }
    for (const taskId in progress) {
      tableRow[tasksDictionary.value[taskId]?.publicName ?? taskId] = progress[taskId].value;
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-progress-${_kebabCase(getTitle(administrationData.value, isSuperAdmin.value))}-${_kebabCase(
      orgData.value.name,
    )}.csv`,
  );
  return;
};

const progressReportColumns = computed(() => {
  if (isLoadingTasksDictionary.value || assignmentData.value === undefined) return [];

  const tableColumns = [];

  // Add launch button if user has permission and administration is open
  const { userCan } = usePermissions();
  const isAdministrationOpen = administrationData.value?.dateClosed
    ? new Date(administrationData.value?.dateClosed) > new Date()
    : false;
  if (userCan(Permissions.Tasks.LAUNCH) && isAdministrationOpen) {
    tableColumns.push({
      header: 'Launch Student',
      launcher: true,
      routeName: 'LaunchHome',
      routeTooltip: 'Launch Student Assessment',
      routeIcon: 'pi pi-arrow-right border-none text-primary hover:text-white',
      sort: false,
      pinned: true,
    });
  }

  if (assignmentData.value.find((assignment) => assignment.user?.username)) {
    tableColumns.push({
      field: 'user.username',
      header: 'Username',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (assignmentData.value.find((assignment) => assignment.user?.email)) {
    tableColumns.push({
      field: 'user.email',
      header: 'Email',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (assignmentData.value.find((assignment) => assignment.user?.name?.first)) {
    tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
  }
  if (assignmentData.value.find((assignment) => assignment.user?.name?.last)) {
    tableColumns.push({ field: 'user.lastName', header: 'Last Name', dataType: 'text', sort: true, filter: true });
  }

  tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true, filter: true });

  if (props.orgType === 'district') {
    const schoolsMap = districtSchoolsData.value?.reduce((acc, school) => {
      acc[school.id] = school.name;
      return acc;
    }, {});
    tableColumns.push({
      field: 'user.schoolName',
      header: 'School',
      dataType: 'text',
      sort: true,
      filter: false,
      useMultiSelect: true,
      multiSelectOptions: districtSchoolsData.value.map((school) => school.name),
      multiSelectPlaceholder: 'Filter by School',
      schoolsMap: schoolsMap,
    });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
  }

  const allTaskIds = administrationData.value.assessments?.map((assessment) => assessment.taskId);
  const sortedTasks = allTaskIds?.sort((p1, p2) => {
    if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
      return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
    } else {
      return -1;
    }
  });

  const priorityTasks = ['swr', 'sre', 'pa'];
  const orderedTasks = [];

  for (const task of priorityTasks) {
    if (sortedTasks.includes(task)) {
      orderedTasks.push(task);
    }
  }

  for (const task of sortedTasks) {
    if (!priorityTasks.includes(task)) {
      orderedTasks.push(task);
    }
  }

  for (const taskId of orderedTasks) {
    tableColumns.push({
      field: `progress.${taskId}.value`,
      filterField: `progress.${taskId}.tags`,
      header: tasksDictionary.value[taskId]?.publicName ?? taskId,
      dataType: 'progress',
      tag: true,
      severityField: `progress.${taskId}.severity`,
      iconField: `progress.${taskId}.icon`,
      sort: true,
    });
  }
  return tableColumns;
});

const filteredTableData = ref(computedProgressData.value);

watch(computedProgressData, (newValue) => {
  // Update filteredTableData when computedProgressData changes
  filteredTableData.value = newValue;
});

watch([filterSchools, filterGrades], ([newSchools, newGrades]) => {
  if (newSchools.length > 0 || newGrades.length > 0) {
    //set scoresTableData to filtered data if filter is added
    let filteredData = computedProgressData.value;
    if (newSchools.length > 0) {
      filteredData = filteredData.filter((item) => {
        return newSchools.includes(item.user.schoolName);
      });
    }
    if (newGrades.length > 0) {
      filteredData = filteredData.filter((item) => {
        return newGrades.includes(item.user.grade);
      });
    }
    filteredTableData.value = filteredData;
  } else {
    filteredTableData.value = computedProgressData.value;
  }
});

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

<style>
.loading-container {
  text-align: center;
}

.loading-wrapper {
  margin: 1rem 0rem;
  display: flex;
  flex-direction: column;
  width: 100%;
  align-items: center;
  justify-content: center;
}

.report-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-top: 0;
}

.no-scores-container {
  display: flex;
  flex-direction: column;
  padding: 2rem;

  h3 {
    font-weight: bold;
  }

  span {
    display: flex;
    align-items: center;
  }
}

.administration-name {
  font-size: 1.8rem;
  font-weight: light;
}

.report-subheader {
  font-size: 1.3rem;
  font-weight: light;
  margin-top: 0;
}

.legend-entry {
  font-size: 0.9rem;
  font-weight: light;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.circle {
  border-color: white;
  display: inline-block;
  border-radius: 50%;
  border-width: 5px;
  height: 25px;
  width: 25px;
  vertical-align: middle;
  margin-right: 10px;
}

.select-button .p-button:last-of-type:not(:only-of-type) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: 25rem;
  border-bottom-right-radius: 25rem;
}

.select-button .p-button:first-of-type:not(:only-of-type) {
  border-top-left-radius: 25rem;
  border-bottom-left-radius: 25rem;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
