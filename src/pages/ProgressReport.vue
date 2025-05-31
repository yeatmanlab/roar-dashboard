<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="isLoading" class="loading-wrapper">
        <LevanteSpinner fullscreen />
        <div class="uppercase text-sm text-gray-600 font-light">Loading Progress Datatable</div>
      </div>

      <template v-else>
        <div class="flex justify-content-between align-items-center">
          <div class="flex flex-column align-items-start mb-4 gap-2">
            <div>
              <div class="uppercase font-light text-gray-500 text-md">{{ displayOrgType }} Progress Report</div>
              <div class="report-title uppercase">
                {{ orgData?.name }}
              </div>
            </div>
            <div>
              <div class="uppercase font-light text-gray-500 text-md">Assignment</div>
              <div class="administration-name uppercase">
                {{ displayName }}
              </div>
            </div>
          </div>
          <div v-if="!isLevante" class="flex flex-row align-items-center gap-4">
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
            v-if="!isEmpty(adminStatsWithSurvey)"
            class="flex flex-column align-items-around flex-wrap gap-3 rounded bg-gray-100 p-5"
          >
            <div class="flex flex-column gap-1 mx-5 mb-5">
              <div class="text-sm uppercase text-gray-500">Progress by Task</div>
              <div
                v-for="{ taskId } of administrationData.assessments"
                :key="taskId"
                class="flex justify-content-between align-items-center"
              >
                <div class="text-lg font-bold text-gray-600 w-full">
                  {{ tasksDictionary[taskId]?.name || taskId }}
                </div>
                <PvChart
                  type="bar"
                  :data="setBarChartData(adminStatsWithSurvey[taskId])"
                  :options="setBarChartOptions(adminStatsWithSurvey[taskId])"
                  class="h-2rem lg:w-full"
                />
              </div>
            </div>
            <div class="flex flex-column mx-5">
              <div class="text-sm uppercase text-gray-500">Total Progress</div>
              <div class="flex justify-content-between align-items-center">
                <div class="text-xl font-bold text-gray-600 w-full">
                  Total
                  <span class="font-light text-sm"> (Assigned to {{ adminStats.assignment.assigned }} users) </span>
                </div>
                <PvChart
                  type="bar"
                  :data="setBarChartData(adminStatsWithSurvey.assignment)"
                  :options="setBarChartOptions(adminStatsWithSurvey.assignment)"
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
                    <div>Not Started</div>
                  </div>
                </div>
              </div>
              <div v-if="!isLevante" class="font-light uppercase text-xs text-gray-500 my-1">Legend</div>
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
            :allow-filtering="!isLevante"
            :reset-filters="resetFilters"
            :allow-export="!isLevante"
            :allow-column-selection="!isLevante"
            :lazy-pre-sorting="orderBy"
            @export-selected="exportSelected"
            @export-all="exportAll"
          >
            <template #filterbar>
              <div v-if="!isLevante">
                <div v-if="districtSchoolsData" class="flex flex-row gap-2">
                  <PvFloatLabel>
                    <PvMultiSelect
                      id="ms-school-filter"
                      v-model="filterSchools"
                      style="width: 20rem; max-width: 25rem"
                      :options="districtSchoolsData"
                      option-label="name"
                      option-value="name"
                      :show-toggle-all="false"
                      selected-items-label="{0} schools selected"
                      data-cy="filter-by-school"
                    />
                    <label for="ms-school-filter">Filter by School</label>
                  </PvFloatLabel>
                </div>
                <div class="flex flex-row gap-2">
                  <PvFloatLabel>
                    <PvMultiSelect
                      id="ms-grade-filter"
                      v-model="filterGrades"
                      style="width: 20rem; max-width: 25rem"
                      :options="gradeOptions"
                      option-label="label"
                      option-value="value"
                      :show-toggle-all="false"
                      selected-items-label="{0} grades selected"
                      data-cy="filter-by-grade"
                    />
                    <label for="ms-school-filter">Filter by Grade</label>
                  </PvFloatLabel>
                </div>
              </div>
            </template>
          </RoarDataTable>
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
import PvMultiSelect from 'primevue/multiselect';
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
import { taskDisplayNames, gradeOptions } from '@/helpers/reports';
import { getTitle } from '@/helpers/query/administrations';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import { isLevante } from '@/helpers';
import { APP_ROUTES } from '@/constants/routes';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';
import RoarDataTable from '@/components/RoarDataTable.vue';
import { isEmpty } from 'lodash';
import PvFloatLabel from 'primevue/floatlabel';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
// import ProgressChartLegend from '@/components/reports/ProgressChartLegend.vue'; // File does not exist
// import ProgressChart from '@/components/reports/ProgressChart.vue'; // File does not exist

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

const displayOrgType = computed(() => {
  if (props.orgType === 'district') {
    return 'Site';
  } else if (props.orgType === 'group') {
    return 'Cohort';
  }
  return props.orgType;
});

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
  router.push({
    path: getDynamicRouterPath(APP_ROUTES.SCORE_REPORT, {
      administrationId,
      orgType,
      orgId,
    }),
  });
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

const { data: adminStats } = useAdministrationsStatsQuery([props.administrationId], {
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

// ------------------------------------------------------------------- Move this to the server, temporarily on client for quicker fix
const surveyStats = ref({
  assigned: 0,
  started: 0,
  completed: 0,
});

const adminStatsWithSurvey = ref({});

// to incorporate survey stats
watch(
  [adminStats, surveyStats],
  ([newAdminStats, newSurveyStats]) => {
    if (newAdminStats && Object.keys(newSurveyStats).length) {
      // Create a new object to avoid mutating the original
      const updatedStats = { ...newAdminStats };

      // Add survey stats if they exist
      if (surveyStats.value.assigned > 0) {
        updatedStats.survey = {
          assigned: newSurveyStats.assigned,
          started: newSurveyStats.started,
          completed: newSurveyStats.completed,
        };

        updatedStats.assignment = {
          assigned: updatedStats.assignment.assigned || 0,
          started: updatedStats.assignment.started || 0,
          completed: updatedStats.assignment.completed || 0,
        };

        // Update the values instead of reassigning
        updatedStats.assignment.started += newSurveyStats.started;
        updatedStats.assignment.completed += newSurveyStats.completed;
      }

      // Update adminStats with the new data
      adminStatsWithSurvey.value = updatedStats;
    }
  },
  { deep: true },
);

// Move survey stats counting logic out of computed property
watch(assignmentData, (newAssignmentData) => {
  if (!newAssignmentData) return;

  // Reset survey stats
  surveyStats.value = {
    assigned: 0,
    started: 0,
    completed: 0,
  };

  // Count survey stats
  newAssignmentData.forEach(({ assignment, survey }) => {
    let surveyAssigned = false;
    for (const task of assignment.assessments) {
      if (task.taskId === 'survey') {
        surveyAssigned = true;
      }
    }

    if (surveyAssigned) {
      if (survey?.progress) {
        surveyStats.value[survey.progress]++;
      }
    }
  });
});

// -------------------------------------------------------------------

const computedProgressData = computed(() => {
  if (!assignmentData.value) return [];
  // assignmentTableData is an array of objects, each representing a row in the table
  const assignmentTableDataAcc = [];

  for (const { assignment, user, survey } of assignmentData.value) {
    // compute schoolName
    let schoolName = '';
    const schoolId = user?.schools?.current[0];
    if (schoolId) {
      schoolName = schoolNameDictionary.value[schoolId];
    }

    const currRow = {
      user: {
        email: user.email || assignment.userData.email,
        userType: user.userType,
        userId: user.userId,
        firstName: user?.name?.first || '',
        lastName: user?.name?.last || '',
        grade: user.studentData?.grade,
        assessmentPid: user.assessmentPid,
        schoolName: schoolName,
      },
      // compute and add progress data in next step
    };

    const currRowProgress = {};

    for (const assessment of assignment.assessments) {
      // General Logic to grab support level, scores, etc
      let progressFilterTags = '';
      const taskId = assessment.taskId;

      if (taskId == 'survey') {
        if (survey?.progress === 'completed') {
          currRowProgress[taskId] = {
            value: survey?.progress,
            icon: 'pi pi-check',
            severity: 'success',
          };
        } else if (survey?.progress === 'started') {
          currRowProgress[taskId] = {
            value: survey?.progress,
            icon: 'pi pi-exclamation-triangle',
            severity: 'warning',
          };
        } else {
          currRowProgress[taskId] = {
            value: survey?.progress,
            icon: 'pi pi-times',
            severity: 'danger',
          };
        }
      } else {
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
            icon: 'pi pi-check-circle',
            severity: 'success',
          };
          progressFilterTags += ' Completed ';
        } else if (assessment?.startedOn !== undefined) {
          currRowProgress[taskId] = {
            value: 'started',
            icon: 'pi pi-clock',
            severity: 'warn',
          };
          progressFilterTags += ' Started ';
        } else {
          currRowProgress[taskId] = {
            value: 'not started',
            icon: 'pi pi-minus-circle',
            severity: 'warning',
          };
          progressFilterTags += ' Not Started ';
        }
      }
      currRowProgress[taskId].tags = progressFilterTags;
    }

    // update progress for current row with computed object
    currRow.progress = currRowProgress;
    // push currRow to assignmentTableDataAcc
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
  const columnDefinitions = [{ field: 'user.email', header: 'Email', pinned: true }];

  columnDefinitions.forEach(({ field, header, pinned }) => {
    const path = field.split('.');
    if (assignmentData.value.find((assignment) => _get(assignment, path))) {
      tableColumns.push({
        field,
        header,
        dataType: 'text',
        sort: true,
        filter: true,
        ...(pinned && { pinned: true }),
      });
    }
  });

  tableColumns.push({
    field: 'user.userId',
    header: 'UID',
    dataType: 'text',
    sort: true,
    filter: true,
  });
  tableColumns.push({
    field: 'user.email',
    header: 'Email',
    dataType: 'text',
    sort: true,
    filter: true,
  });

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
      schoolsMap: schoolsMap,
    });
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
      header: tasksDictionary.value[taskId]?.name ?? taskId,
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
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
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
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.select-button .p-button:first-of-type:not(:only-of-type) {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
