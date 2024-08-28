<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex justify-content-between align-items-center">
        <div v-if="!isLoadingScores">
          <div class="flex flex-column align-items-start mb-4 gap-2">
            <div>
              <div class="uppercase font-light text-gray-500 text-md">{{ props.orgType }} Progress Report</div>
              <div class="report-title uppercase">
                {{ orgInfo?.name }}
              </div>
            </div>
            <div>
              <div class="uppercase font-light text-gray-500 text-md">Administration</div>
              <div class="administration-name uppercase">
                {{ displayName }}
              </div>
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
        <PvButton
          class="flex flex-row p-2 text-sm bg-primary text-white border-none border-round h-2rem text-sm hover:bg-red-900"
          icon="pi pi-download mr-2"
          label="Download Combination of Reports"
          @click="
            () =>
              exportReportCombination(
                assignmentData,
                tasksDictionary,
                authStore,
                props,
                orgInfo,
                administrationInfo,
                isSuperAdmin,
              )
          "
        />
      </div>
      <div v-if="isLoadingScores" class="loading-wrapper">
        <AppSpinner style="margin: 1rem 0rem" />
        <div class="uppercase text-sm text-gray-600 font-light">Loading Progress Datatable</div>
      </div>
      <div v-if="assignmentData?.length ?? 0 > 0">
        <div
          v-if="adminStats != null"
          class="flex flex-column align-items-around flex-wrap gap-3 rounded bg-gray-100 p-5"
        >
          <div class="flex flex-column gap-1 mx-5 mb-5">
            <div class="text-sm uppercase text-gray-500">Progress by Assessment</div>
            <div
              v-for="{ taskId } of administrationInfo.assessments"
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
                Total <span class="font-light text-sm"> ({{ adminStats.assignment.assigned }} total assignments) </span>
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
          :loading="isLoadingScores || isFetchingScores"
          :page-limit="pageLimit"
          data-cy="roar-data-table"
          :allow-filtering="true"
          :reset-filters="resetFilters"
          @export-selected="exportSelected"
          @export-all="exportAll"
        >
          <template #filterbar>
            <div v-if="schoolsInfo" class="flex flex-row gap-2">
              <span class="p-float-label">
                <PvMultiSelect
                  id="ms-school-filter"
                  v-model="filterSchools"
                  style="width: 20rem; max-width: 25rem"
                  :options="schoolsInfo"
                  option-label="name"
                  option-value="name"
                  :show-toggle-all="false"
                  selected-items-label="{0} schools selected"
                  data-cy="filter-by-school"
                />
                <label for="ms-school-filter">Filter by School</label>
              </span>
            </div>
            <div class="flex flex-row gap-2">
              <span class="p-float-label">
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
              </span>
            </div>
          </template>
        </RoarDataTable>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import _map from 'lodash/map';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { taskDisplayNames, gradeOptions } from '@/helpers/reports';
import { exportReportCombination } from '@/helpers/exportReports';
import { getTitle } from '@/helpers/query/administrations';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';

const authStore = useAuthStore();

const { roarfirekit, uid, userQueryKeyIndex, tasksDictionary } = storeToRefs(authStore);

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

const reportView = ref({ name: 'Progress Report', constant: true });
const reportViews = [
  { name: 'Progress Report', constant: true },
  { name: 'Score Report', constant: false },
];

const displayName = computed(() => {
  if (administrationInfo.value) {
    return getTitle(administrationInfo.value, isSuperAdmin.value);
  }
  return '';
});

const handleViewChange = () => {
  window.location.href = `/scores/${props.administrationId}/${props.orgType}/${props.orgId}`;
};

const orderBy = ref([
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'user.grade',
    },
  },
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'user.lastName',
    },
  },
]);
// If this is a district report, make the schools column first sorted.
if (props.orgType === 'district') {
  orderBy.value.unshift({
    direction: 'ASCENDING',
    field: {
      fieldPath: 'readOrgs.schools',
    },
  });
}

const filterSchools = ref([]);
const filterGrades = ref([]);
const pageLimit = ref(10);

// User Claims
const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', uid, userQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
const claimsLoaded = computed(() => !isLoadingClaims.value);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const { data: administrationInfo } = useQuery({
  queryKey: ['administrationInfo', uid, props.administrationId],
  queryFn: () =>
    fetchDocById('administrations', props.administrationId, ['name', 'publicName', 'assessments'], 'admin'),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: adminStats } = useQuery({
  queryKey: ['administrationStats', uid, props.administrationId],
  queryFn: () => fetchDocById('administrations', `${props.administrationId}/stats/total`),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
  onSuccess: (data) => {
    console.log(data);
  },
});

const { data: orgInfo } = useQuery({
  queryKey: ['orgInfo', uid, props.orgId],
  queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Grab schools if this is a district score report
const { data: schoolsInfo } = useQuery({
  queryKey: ['schools', uid, ref(props.orgId)],
  queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs, ['name', 'id', 'lowGrade']),
  keepPreviousData: true,
  enabled: props.orgType === 'district' && initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const scoreQueryEnabled = computed(() => initialized.value && claimsLoaded.value);
// Scores Query
const {
  isLoading: isLoadingScores,
  isFetching: isFetchingScores,
  data: assignmentData,
} = useQuery({
  queryKey: ['assignments', uid, props.administrationId, props.orgId],
  queryFn: () => assignmentFetchAll(props.administrationId, props.orgType, props.orgId, true),
  keepPreviousData: true,
  enabled: scoreQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

const schoolNameDictionary = computed(() => {
  if (schoolsInfo.value) {
    return schoolsInfo.value.reduce((acc, school) => {
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
        firstName: user.name.first,
        lastName: user.name.last,
        grade: grade,
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
          icon: 'pi pi-exclamation-triangle',
          severity: 'warning',
        };
        progressFilterTags += ' Started ';
      } else {
        currRowProgress[taskId] = {
          value: 'assigned',
          icon: 'pi pi-times',
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
    `roar-progress-${_kebabCase(getTitle(administrationInfo.value, isSuperAdmin.value))}-${_kebabCase(
      orgInfo.value.name,
    )}.csv`,
  );
  return;
};

const progressReportColumns = computed(() => {
  if (assignmentData.value === undefined) return [];

  const tableColumns = [];
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
    const schoolsMap = schoolsInfo.value?.reduce((acc, school) => {
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

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
  }

  const allTaskIds = administrationInfo.value.assessments?.map((assessment) => assessment.taskId);
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
