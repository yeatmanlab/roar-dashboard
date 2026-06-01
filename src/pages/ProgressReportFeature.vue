<template>
  <main class="container main">
    <section class="main-body">
      <div v-if="isPageLoading" class="loading-wrapper">
        <LevanteSpinner fullscreen />
        <div class="uppercase text-sm text-gray-600 font-light">Loading Progress Datatable</div>
      </div>

      <template v-else>
        <div
          v-if="loadError"
          class="flex justify-content-center align-items-center"
          style="min-height: calc(100vh - 8rem)"
        >
          <div style="max-width: 48rem; text-align: center">
            <div class="text-lg font-semibold text-gray-700">There was a problem fetching the assignment details.</div>
            <div class="mt-2 text-sm text-gray-500">Please refresh the page or try again later.</div>
          </div>
        </div>

        <template v-else>
          <div class="flex justify-content-between align-items-center">
            <div class="flex flex-column align-items-start mb-4 gap-2">
              <div>
                <div class="uppercase font-light text-gray-500 text-md">{{ displayOrgType }} Progress Report</div>
                <div class="report-title">
                  {{ orgDoc?.name }}
                </div>
              </div>
              <div>
                <div class="uppercase font-light text-gray-500 text-md">Assignment</div>
                <div class="administration-name">
                  {{ assignmentDisplayName }}
                </div>
              </div>
              <div>
                <div class="uppercase font-light text-gray-500 text-md">Created by</div>
                <div class="administration-creator">
                  {{ creatorName }}
                </div>
              </div>
            </div>
            <div v-if="!isLevante" class="flex flex-row align-items-center gap-4">
              <div class="uppercase text-sm text-gray-600">VIEW</div>
              <PvSelectButton
                v-model="reportView"
                v-tooltip.top="getTooltip('View different report', { showDelay: 0 })"
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

          <div v-if="!progressUsers?.length || !totalChartStats" class="empty-user-list">
            <div class="text-lg font-semibold text-gray-700">Could not find users for {{ orgDoc?.name }}.</div>
            <div class="mt-2 text-sm text-gray-500">
              <a href="/add-users">Add users</a> to <span class="font-bold">{{ orgDoc?.name }}</span> to see the
              progress report.
            </div>
          </div>

          <div v-else>
            <div class="flex flex-column align-items-around flex-wrap gap-3 rounded bg-gray-100 p-2 details-card">
              <div class="flex flex-column gap-1 mx-5 mb-5">
                <div class="text-sm uppercase text-gray-500">Progress by Task</div>
                <div
                  v-for="taskId of orderedTaskIds"
                  :key="taskId"
                  class="flex justify-content-between align-items-center"
                >
                  <div class="text-lg font-bold text-gray-600 w-full">
                    {{ taskLabel(taskId) }}
                  </div>
                  <PvChart
                    type="bar"
                    :data="setBarChartData(taskChartStats[taskId])"
                    :options="setBarChartOptions(taskChartStats[taskId])"
                    class="h-2rem lg:w-full"
                  />
                </div>
              </div>
              <div class="flex flex-column mx-5">
                <div class="text-sm uppercase text-gray-500">Total Progress</div>
                <div class="flex justify-content-between align-items-center">
                  <div class="text-xl font-bold text-gray-600 w-full">
                    Total
                    <span class="font-light text-sm"> (Assigned to {{ totalAssignedCount }} users) </span>
                  </div>
                  <PvChart
                    type="bar"
                    :data="setBarChartData(totalChartStats)"
                    :options="setBarChartOptions(totalChartStats)"
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
              v-if="(progressReportColumns?.length ?? 0) > 0"
              :data="filteredTableData"
              :columns="progressReportColumns"
              :total-records="filteredTableData?.length"
              :loading="false"
              :page-limit="pageLimit"
              data-cy="roar-data-table"
              :allow-filtering="!isLevante"
              :reset-filters="resetFilters"
              :allow-export="true"
              :lazy-pre-sorting="orderBy"
              :show-options-control="true"
              :show-options="true"
              @export-selected="exportSelected"
              @export-all="exportAll"
            >
              <template #filterbar>
                <div class="inline-flex gap-1">
                  <div class="w-8">
                    <PvFloatLabel>
                      <PvInputText v-model="searchInput" class="w-full" :maxlength="50" />
                      <label>Search login...</label>
                    </PvFloatLabel>
                  </div>
                  <div class="w-5">
                    <PvFloatLabel>
                      <PvMultiSelect
                        v-model="selectedUserTypes"
                        class="w-full"
                        filter
                        filter-placeholder="Search..."
                        option-label="label"
                        option-value="value"
                        selected-items-label="{0} user types selected"
                        :max-selected-labels="2"
                        :options="userTypeOptions"
                      />
                      <label>User types</label>
                    </PvFloatLabel>
                  </div>
                </div>
              </template>
            </RoarDataTable>
          </div>
        </template>
      </template>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import _map from 'lodash/map';
import _startCase from 'lodash/startCase';
import PvChart from 'primevue/chart';
import PvMultiSelect from 'primevue/multiselect';
import PvSelectButton from 'primevue/selectbutton';
import { useAuthStore } from '@/store/auth';
import { useAdministrationSyncStatus } from '@/composables/useAdministrationSyncStatus';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { getDynamicRouterPath } from '@/helpers/getDynamicRouterPath';
import { exportCsv } from '@/helpers/query/utils';
import { normalizeUserTypeForDisplay } from '@/helpers/userType';
import { taskDisplayNames } from '@/helpers/reports';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import { isLevante, getTooltip, normalizeToLowercase } from '@/helpers';
import { APP_ROUTES } from '@/constants/routes';
import RoarDataTable from '@/components/RoarDataTable.vue';
import PvFloatLabel from 'primevue/floatlabel';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import PvInputText from 'primevue/inputtext';
import _capitalize from 'lodash/capitalize';
import { administrationsRepository } from '@/firebase/repositories/AdministrationsRepository';
import { usersRepository } from '@/firebase/repositories/UsersRepository';

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

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);
const isFetchingProgress = ref(false);
const loadError = ref(null);
const administration = ref(null);
const orgDoc = ref(null);
const progressPayload = ref(null);

const userTypeOptions = ref([]);
const selectedUserTypes = ref([]);
const searchInput = ref('');

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery({
  enabled: initialized,
});

const { displayedSyncStatus } = useAdministrationSyncStatus(administration, {
  defaultStatus: undefined,
});

watch(
  [isFetchingProgress, displayedSyncStatus],
  ([loading, status]) => {
    if (!loading && administration.value && (status === 'pending' || status === 'failed')) {
      router.replace({ name: 'Administrator' });
    }
  },
  { immediate: true },
);

const routeOrgTypeToCollectionKey = (orgType) => {
  const m = {
    district: 'districts',
    school: 'schools',
    class: 'classes',
    group: 'groups',
  };
  return m[orgType];
};

const statsFromExclusiveCounts = (notStarted, started, completed) => ({
  assigned: notStarted + started + completed,
  started: started + completed,
  completed,
});

const aggregateTaskProgressByTaskId = (taskProgress) => {
  const map = {};
  for (const row of taskProgress ?? []) {
    const key = row.taskId.toLowerCase();
    if (!map[key]) {
      map[key] = { notStarted: 0, started: 0, completed: 0 };
    }
    map[key].notStarted += row.counts.notStarted;
    map[key].started += row.counts.started;
    map[key].completed += row.counts.completed;
  }
  return map;
};

const statusForUserOnTask = (userId, taskId, taskProgress) => {
  const tid = taskId.toLowerCase();
  for (const row of taskProgress ?? []) {
    if (row.taskId.toLowerCase() !== tid) continue;
    if (row.userIds.completed.includes(userId)) return 'completed';
  }
  for (const row of taskProgress ?? []) {
    if (row.taskId.toLowerCase() !== tid) continue;
    if (row.userIds.started.includes(userId)) return 'started';
  }
  return 'notStarted';
};

const progressCellFromStatus = (status) => {
  if (status === 'completed') {
    return {
      value: 'Completed',
      icon: 'pi pi-check-circle',
      severity: 'success',
      tags: ' Completed ',
    };
  }
  if (status === 'started') {
    return {
      value: 'Started',
      icon: 'pi pi-clock',
      severity: 'warn',
      tags: ' Started ',
    };
  }
  return {
    value: 'Not Started',
    icon: 'pi pi-minus-circle',
    severity: 'warning',
    tags: ' Not Started ',
  };
};

const fetchProgressData = async () => {
  if (!initialized.value) return;
  isFetchingProgress.value = true;
  loadError.value = null;
  try {
    const orgTypeKey = routeOrgTypeToCollectionKey(props.orgType);
    if (!orgTypeKey) {
      throw new Error(`Unsupported org type: ${props.orgType}`);
    }
    const [admin, org, progress] = await Promise.all([
      administrationsRepository.fetchAdministrationById(props.administrationId),
      administrationsRepository.fetchOrgBySingularRouteType(props.orgType, props.orgId),
      usersRepository.getAdministrationOrgProgress({
        administrationId: props.administrationId,
        orgId: props.orgId,
        orgType: orgTypeKey,
      }),
    ]);
    administration.value = admin;
    orgDoc.value = org;
    progressPayload.value = progress;
  } catch (e) {
    loadError.value = e;
  } finally {
    isFetchingProgress.value = false;
  }
};

watch(
  [initialized, () => props.administrationId, () => props.orgType, () => props.orgId],
  () => {
    if (initialized.value) fetchProgressData();
  },
  { immediate: true },
);

const progressUsers = computed(() => progressPayload.value?.users ?? []);

const orderedTaskIds = computed(() => {
  const fromAdmin = administration.value?.assessments?.map((a) => a.taskId.toLowerCase());
  if (fromAdmin?.length) {
    return [...fromAdmin].sort((a, b) => (taskDisplayNames[a]?.order ?? 0) - (taskDisplayNames[b]?.order ?? 0));
  }
  const fromProgress = [...new Set((progressPayload.value?.taskProgress ?? []).map((r) => r.taskId.toLowerCase()))];
  return fromProgress.sort((a, b) => (taskDisplayNames[a]?.order ?? 0) - (taskDisplayNames[b]?.order ?? 0));
});

const taskChartStats = computed(() => {
  const aggregated = aggregateTaskProgressByTaskId(progressPayload.value?.taskProgress);
  const out = {};
  for (const taskId of orderedTaskIds.value) {
    const c = aggregated[taskId] ?? { notStarted: 0, started: 0, completed: 0 };
    out[taskId] = statsFromExclusiveCounts(c.notStarted, c.started, c.completed);
  }
  return out;
});

const totalChartStats = computed(() => {
  const users = progressUsers.value;
  if (!users.length) return null;

  const assignedTotal = users.length;
  const completed = users.filter((u) => u.status === 'completed').length;
  const startedOnly = users.filter((u) => u.status === 'started').length;
  const notStarted = Math.max(0, assignedTotal - completed - startedOnly);
  return statsFromExclusiveCounts(notStarted, startedOnly, completed);
});

const totalAssignedCount = computed(() => progressUsers.value.length);

const creatorName = computed(() => administration.value?.creatorName ?? '');

const displayOrgType = computed(() => {
  switch (props.orgType) {
    case 'district':
      return 'Site';
    case 'group':
      return 'Cohort';
    default:
      return _capitalize(props.orgType);
  }
});

const isPageLoading = computed(() => !initialized.value || isFetchingProgress.value || isLoadingTasksDictionary.value);

const reportView = ref({ name: 'Progress Report', constant: true });
const reportViews = [
  { name: 'Progress Report', constant: true },
  { name: 'Score Report', constant: false },
];

const assignmentDisplayName = computed(() => administration.value?.name ?? '');

const handleViewChange = () => {
  const { administrationId, orgType, orgId } = props;
  router.push({
    path: getDynamicRouterPath(APP_ROUTES.SCORE_REPORT, {
      administrationId,
      orgType,
      orgId,
    }),
    query: route.query,
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

if (props.orgType === 'district') {
  orderBy.value.unshift({
    order: '1',
    field: 'user.schoolName',
  });
}

const filterSchools = ref([]);
const filterGrades = ref([]);
const pageLimit = ref(10);

const CSV_NOT_ASSIGNED_VALUE = 'Not Assigned';

const taskLabel = (taskId) => {
  if (tasksDictionary.value?.[taskId]?.publicName) {
    return tasksDictionary.value[taskId].publicName;
  }
  if (tasksDictionary.value?.[taskId]?.name) {
    return tasksDictionary.value[taskId].name;
  }
  const fromProgress = progressPayload.value?.taskProgress?.find((r) => r.taskId.toLowerCase() === taskId);
  if (fromProgress?.variantName) return fromProgress.variantName;
  return _startCase(taskId);
};

const getTaskColumnLabel = (taskId) => {
  if (tasksDictionary.value?.[taskId]?.publicName) {
    return tasksDictionary.value[taskId].publicName;
  }
  if (tasksDictionary.value?.[taskId]?.name) {
    return tasksDictionary.value[taskId].name;
  }
  return _startCase(taskId);
};

const appendTaskProgressColumns = (row, progress = {}) => {
  const addTaskValue = (taskId) => {
    const columnLabel = getTaskColumnLabel(taskId);
    row[columnLabel] = progress?.[taskId]?.value ?? CSV_NOT_ASSIGNED_VALUE;
  };

  orderedTaskIds.value.forEach(addTaskValue);
};

const buildProgressExportRow = (user, progress = {}) => {
  const tableRow = {
    'User Login': _get(user, 'username') ?? '',
    'User Type': _startCase(normalizeUserTypeForDisplay(_get(user, 'userType') ?? '')),
  };

  if (props.orgType === 'district') {
    tableRow.School = _get(user, 'schoolName') ?? '';
  }

  appendTaskProgressColumns(tableRow, progress);

  return tableRow;
};

const buildExportData = (rows) => {
  if (!rows) return [];
  return _map(rows, ({ user, progress }) => buildProgressExportRow(user, progress));
};

const computedProgressData = computed(() => {
  if (!progressPayload.value) return [];
  const taskProgress = progressPayload.value.taskProgress ?? [];
  const rows = [];

  for (const u of progressUsers.value) {
    const currRowProgress = {};
    for (const taskId of orderedTaskIds.value) {
      const st = statusForUserOnTask(u.userId, taskId, taskProgress);
      currRowProgress[taskId] = progressCellFromStatus(st);
    }

    rows.push({
      user: {
        username: u.email || u.userId,
        userType: normalizeUserTypeForDisplay(u.userType),
        userId: u.userId,
        grade: undefined,
        assessmentPid: undefined,
      },
      progress: currRowProgress,
    });
  }

  return rows;
});

const resetFilters = () => {
  filterSchools.value = [];
  filterGrades.value = [];
};

const exportSelected = (selectedRows) => {
  const computedExportData = buildExportData(selectedRows);
  exportCsv(computedExportData, 'progress-selected.csv');
};

const exportAll = async () => {
  const computedExportData = buildExportData(computedProgressData.value);
  const administrationTitle = administration.value?.name ?? 'progress';
  const orgName = orgDoc.value?.name ?? 'organization';
  const formattedFileName = `progress-report-${_kebabCase(administrationTitle)}-${_kebabCase(orgName) || 'org'}.csv`;
  exportCsv(computedExportData, formattedFileName);
};

const progressReportColumns = computed(() => {
  if (isLoadingTasksDictionary.value || progressPayload.value === undefined) return [];

  const tableColumns = [
    { field: 'user.userId', header: 'UID', dataType: 'text', sort: true, filter: true },
    { field: 'user.username', header: 'User Login', dataType: 'text', sort: true, filter: true },
    { field: 'user.userType', header: 'User Type', dataType: 'text', sort: true, filter: true },
  ];

  for (const taskId of orderedTaskIds.value) {
    tableColumns.push({
      field: `progress.${taskId}.value`,
      filterField: `progress.${taskId}.tags`,
      header: tasksDictionary.value[taskId]?.name ?? getTaskColumnLabel(taskId),
      dataType: 'progress',
      tag: true,
      severityField: `progress.${taskId}.severity`,
      iconField: `progress.${taskId}.icon`,
      sort: true,
    });
  }

  return tableColumns;
});

const filteredTableData = ref([]);

watch(computedProgressData, (newValue) => {
  filteredTableData.value = newValue;

  userTypeOptions.value = Array.from(new Set(newValue?.map((item) => item?.user?.userType))).map((userType) => ({
    label: _startCase(userType),
    value: userType,
  }));

  selectedUserTypes.value = Array.from(new Set(newValue?.map((item) => item?.user?.userType)));
});

watch([filterSchools, filterGrades], ([newSchools, newGrades]) => {
  if (newSchools.length > 0 || newGrades.length > 0) {
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

watch([searchInput, selectedUserTypes], ([newSearchInput, newSelectedUserTypes]) => {
  let filteredData = computedProgressData.value;

  if (newSearchInput) {
    const normalizedSearchInput = normalizeToLowercase(newSearchInput);
    filteredData = filteredData?.filter((data) => {
      const normalizedUID = normalizeToLowercase(data?.user?.username);
      return normalizedUID.includes(normalizedSearchInput);
    });
  }

  if (newSelectedUserTypes) {
    filteredData = filteredData?.filter((data) => newSelectedUserTypes.includes(data?.user?.userType));
  }

  filteredTableData.value = filteredData;
});

let unsubscribe;
const refresh = () => {
  if (unsubscribe) unsubscribe();

  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) refresh();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
});
</script>

<style lang="scss">
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
  @media (max-width: 768px) {
    font-size: 1.8rem;
  }
}

.administration-name {
  font-size: 1.8rem;
  font-weight: light;
}

.administration-creator {
  font-size: 1.2rem;
  font-weight: light;
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
.details-card {
  max-width: 100%;
}

.empty-user-list {
  display: flex-column;
  align-items: center;
  width: 100%;
  height: auto;
  margin: 2rem 0 0;
  padding: 1.5rem 0 0;
  border-top: 1px solid var(--gray-100);
  text-align: center;
}
</style>
