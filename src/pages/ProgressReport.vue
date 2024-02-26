<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex justify-content-between align-items-center">
        <div>
          <div class="flex flex-column align-items-start mb-4 gap-2">
            <div>
              <div class="uppercase font-light text-gray-500 text-md">{{ props.orgType }} Progress Report</div>
              <div class="report-title uppercase">
                {{ orgInfo.name }}
              </div>
            </div>
            <div>
              <div class="uppercase font-light text-gray-500 text-md">Administration</div>
              <div class="administration-name uppercase">
                {{ administrationInfo?.name }}
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-row align-items-center gap-4">
          <div class="uppercase text-sm text-gray-600">VIEW</div>
          <PvSelectButton
            v-model="reportView"
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

      <RoarDataTable
        v-if="columns?.length ?? 0 > 0"
        :data="tableData"
        :columns="columns"
        :total-records="assignmentCount"
        :loading="isLoadingScores || isFetchingScores"
        :page-limit="pageLimit"
        lazy
        data-cy="roar-data-table"
        :allow-filtering="false"
        @page="onPage($event)"
        @sort="onSort($event)"
        @export-selected="exportSelected"
        @export-all="exportAll"
      />
      <div v-else class="loading-container">
        <AppSpinner style="margin-bottom: 1rem" />
        <span>Loading Progress Data</span>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _find from 'lodash/find';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _kebabCase from 'lodash/kebabCase';
import _map from 'lodash/map';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { orderByDefault, fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { taskDisplayNames } from '@/helpers/reports.js';

const authStore = useAuthStore();

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
  { name: 'Score Report', constant: false },
  { name: 'Progress Report', constant: true },
];

const handleViewChange = () => {
  window.location.href = `/scores/${props.administrationId}/${props.orgType}/${props.orgId}`;
};

// Queries for page
const orderBy = ref(orderByDefault);
const pageLimit = ref(10);
const page = ref(0);
// User Claims
const { isLoading: isLoadingClaims, data: userClaims } = useQuery({
  queryKey: ['userClaims', authStore.uid, authStore.userQueryKeyIndex],
  queryFn: () => fetchDocById('userClaims', authStore.uid),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
const claimsLoaded = computed(() => !isLoadingClaims.value);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const { data: administrationInfo } = useQuery({
  queryKey: ['administrationInfo', props.administrationId],
  queryFn: () => fetchDocById('administrations', props.administrationId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const { data: orgInfo } = useQuery({
  queryKey: ['orgInfo', props.orgId],
  queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const schoolInfoQueryEnabled = computed(() => props.orgType === 'district' && initialized.value);

// Grab schools if this is a district score report
const { data: schoolsInfo } = useQuery({
  queryKey: ['schools', ref(props.orgId)],
  queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs),
  keepPreviousData: true,
  enabled: schoolInfoQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const scoreQueryEnabled = computed(() => initialized.value && claimsLoaded.value);
// Scores Query
const {
  isLoading: isLoadingScores,
  isFetching: isFetchingScores,
  data: assignmentData,
} = useQuery({
  queryKey: ['assignments', props.administrationId, props.orgId, pageLimit, page],
  queryFn: () => assignmentPageFetcher(props.administrationId, props.orgType, props.orgId, pageLimit, page),
  keepPreviousData: true,
  enabled: scoreQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

// Scores count query
const { data: assignmentCount } = useQuery({
  queryKey: ['assignments', props.administrationId, props.orgId],
  queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId),
  keepPreviousData: true,
  enabled: scoreQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
};

const exportSelected = (selectedRows) => {
  const computedExportData = _map(selectedRows, ({ user, assignment }) => {
    const tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        tableRow['School'] = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId;
      if (assessment.completedOn !== undefined) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Completed';
      } else if (assessment.startedOn !== undefined) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Started';
      } else {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Assigned';
      }
    }
    return tableRow;
  });
  exportCsv(computedExportData, 'roar-progress-selected.csv');
};

const exportAll = async () => {
  const exportData = await assignmentFetchAll(props.administrationId, props.orgType, props.orgId);
  const computedExportData = _map(exportData, ({ user, assignment }) => {
    const tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade'),
    };
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid');
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        tableRow['School'] = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId;
      if (assessment.completedOn !== undefined) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Completed';
      } else if (assessment.startedOn !== undefined) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Started';
      } else {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Assigned';
      }
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-progress-${_kebabCase(administrationInfo.value.name)}-${_kebabCase(orgInfo.value.name)}.csv`,
  );
};

const columns = computed(() => {
  if (assignmentData.value === undefined) return [];

  const tableColumns = [
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: false },
    { field: 'user.name.first', header: 'First Name', dataType: 'text', sort: false },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text', sort: false },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'text', sort: false },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: false });
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: 'user.assessmentPid', header: 'PID', dataType: 'text', sort: false });
  }

  if (tableData.value.length > 0) {
    const sortedTasks = Object.keys(tableData.value[0].status).sort((p1, p2) => {
      if (Object.keys(taskDisplayNames).includes(p1) && Object.keys(taskDisplayNames).includes(p2)) {
        return taskDisplayNames[p1].order - taskDisplayNames[p2].order;
      } else {
        return -1;
      }
    });
    for (const taskId of sortedTasks) {
      tableColumns.push({
        field: `status.${taskId}.value`,
        header: taskDisplayNames[taskId]?.name ?? taskId,
        dataType: 'text',
        tag: true,
        severityField: `status.${taskId}.severity`,
        iconField: `status.${taskId}.icon`,
        sort: false,
      });
    }
  }
  return tableColumns;
});

const tableData = computed(() => {
  if (assignmentData.value === undefined) return [];

  return assignmentData.value.map(({ user, assignment }) => {
    const status = {};
    for (const assessment of assignment?.assessments || []) {
      if (assessment.completedOn !== undefined) {
        status[assessment.taskId] = {
          value: 'completed',
          icon: 'pi pi-check',
          severity: 'success',
        };
      } else if (assessment.startedOn !== undefined) {
        status[assessment.taskId] = {
          value: 'started',
          icon: 'pi pi-exclamation-triangle',
          severity: 'warning',
        };
      } else {
        status[assessment.taskId] = {
          value: 'assigned',
          icon: 'pi pi-times',
          severity: 'danger',
        };
      }
    }
    // If this is a district score report, grab school information
    if (props.orgType === 'district') {
      // Grab user's school list
      const currentSchools = _get(user, 'schools.current');
      if (currentSchools.length) {
        const schoolId = currentSchools[0];
        const schoolName = _get(
          _find(schoolsInfo.value, (school) => school.id === schoolId),
          'name',
        );
        return {
          user: {
            ...user,
            schoolName,
          },
          assignment,
          status,
        };
      }
    }
    return {
      user,
      assignment,
      status,
    };
  });
});

let unsubscribe;

const init = async () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

const { roarfirekit } = storeToRefs(authStore);
onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
});
</script>

<style>
.p-button {
  margin: 0px 8px;
}

.loading-container {
  text-align: center;
}

.report-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-top: 0;
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
</style>
