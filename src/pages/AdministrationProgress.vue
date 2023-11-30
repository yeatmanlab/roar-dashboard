<template>
  <main class="container main">
    <aside class="main-sidebar">
      <AdministratorSidebar :actions="sidebarActions" />
    </aside>
    <section class="main-body">
      <Panel header="Administration Progress">
        <div>
          <p v-if="orgInfo">{{ _capitalize(props.orgType) }}: {{ orgInfo.name }}</p>
          <p v-if="administrationInfo">Administration: {{ administrationInfo.name }}</p>
        </div>

        <RoarDataTable v-if="columns?.length ?? 0 > 0" :data="tableData" :columns="columns"
          :totalRecords="assignmentCount" :loading="isLoadingScores || isFetchingScores" :pageLimit="pageLimit" lazy
          @page="onPage($event)" @sort="onSort($event)" @export-selected="exportSelected" @export-all="exportAll"
          data-cy="roar-data-table"/>
        <div v-else class="loading-container">
          <AppSpinner style="margin-bottom: 1rem;" />
          <span>Loading Progress Data</span>
        </div>
      </Panel>
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import _map from 'lodash/map'
import _get from 'lodash/get'
import _find from 'lodash/find'
import _kebabCase from 'lodash/kebabCase'
import _capitalize from 'lodash/capitalize';
import { useAuthStore } from '@/store/auth';
import { useQueryStore } from '@/store/query';
import AdministratorSidebar from "@/components/AdministratorSidebar.vue";
import { getSidebarActions } from "@/router/sidebarActions";
import { useQuery } from '@tanstack/vue-query';
import { orderByDefault, fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from "@/helpers/query/assignments";
import { orgFetcher } from "@/helpers/query/orgs";
import { pluralizeFirestoreCollection } from "@/helpers";

const authStore = useAuthStore();
const queryStore = useQueryStore();

const sidebarActions = ref(getSidebarActions(authStore.isUserSuperAdmin, true));

const props = defineProps({
  administrationId: String,
  orgType: String,
  orgId: String,
});

const initialized = ref(false);

// Queries for page
const orderBy = ref(orderByDefault);
const pageLimit = ref(10);
const page = ref(0);
// User Claims
const { isLoading: isLoadingClaims, isFetching: isFetchingClaims, data: userClaims } =
  useQuery({
    queryKey: ['userClaims', authStore.uid, authStore.userQueryKeyIndex],
    queryFn: () => fetchDocById('userClaims', authStore.uid),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
const claimsLoaded = computed(() => !isLoadingClaims.value);
const isSuperAdmin = computed(() => Boolean(userClaims.value?.claims?.super_admin));
const adminOrgs = computed(() => userClaims.value?.claims?.minimalAdminOrgs);

const { isLoading: isLoadingAdminData, isFetching: isFetchingAdminData, data: administrationInfo } =
  useQuery({
    queryKey: ['administrationInfo', props.administrationId],
    queryFn: () => fetchDocById('administrations', props.administrationId, ['name']),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

const { isLoading: isLoadingOrgInfo, isFetching: isFetchingOrgInfo, data: orgInfo } =
  useQuery({
    queryKey: ['orgInfo', props.orgId],
    queryFn: () => fetchDocById(pluralizeFirestoreCollection(props.orgType), props.orgId, ['name']),
    keepPreviousData: true,
    enabled: initialized,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

// Grab schools if this is a district score report
const { isLoading: isLoadingSchools, isFetching: isFetchingSchools, data: schoolsInfo } =
  useQuery({
    queryKey: ['schools', ref(props.orgId)],
    queryFn: () => orgFetcher('schools', ref(props.orgId), isSuperAdmin, adminOrgs),
    keepPreviousData: true,
    enabled: (props.orgType === 'district' && initialized),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

// Scores Query
let { isLoading: isLoadingScores, isFetching: isFetchingScores, data: assignmentData } =
  useQuery({
    queryKey: ['assignments', props.administrationId, props.orgId, pageLimit, page],
    queryFn: () => assignmentPageFetcher(props.administrationId, props.orgType, props.orgId, pageLimit, page),
    keepPreviousData: true,
    enabled: (initialized && claimsLoaded),
    staleTime: 5 * 60 * 1000, // 5 mins
  })

// Scores count query
const { isLoading: isLoadingCount, data: assignmentCount } =
  useQuery({
    queryKey: ['assignments', props.administrationId, props.orgId],
    queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId),
    keepPreviousData: true,
    enabled: (initialized && claimsLoaded),
    staleTime: 5 * 60 * 1000,
  })

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
}

const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => ({
    field: { fieldPath: item.field },
    direction: item.order === 1 ? "ASCENDING" : "DESCENDING",
  }));
  orderBy.value = !_isEmpty(_orderBy) ? _orderBy : orderByDefault;
}

const exportSelected = (selectedRows) => {
  const computedExportData = _map(selectedRows, ({ user, assignment }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade')
    }
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid')
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current')
      if (currentSchools.length) {
        const schoolId = currentSchools[0]
        tableRow['School'] = _get(_find(schoolsInfo.value, school => school.id === schoolId), 'name')
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId
      if (assessment.completedOn !== undefined) {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Completed'
      } else if (assessment.startedOn !== undefined) {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Started'
      } else {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Assigned'
      }
    }
    return tableRow
  })
  exportCsv(computedExportData, 'roar-scores-selected.csv');
}

const exportAll = async () => {
  const exportData = await assignmentFetchAll(props.administrationId, props.orgType, props.orgId)
  const computedExportData = _map(exportData, ({ user, assignment }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'name.first'),
      Last: _get(user, 'name.last'),
      Grade: _get(user, 'studentData.grade')
    }
    if (authStore.isUserSuperAdmin) {
      tableRow['PID'] = _get(user, 'assessmentPid')
    }
    if (props.orgType === 'district') {
      const currentSchools = _get(user, 'schools.current')
      if (currentSchools.length) {
        const schoolId = currentSchools[0]
        tableRow['School'] = _get(_find(schoolsInfo.value, school => school.id === schoolId), 'name')
      }
    }
    for (const assessment of assignment.assessments) {
      const taskId = assessment.taskId
      if (assessment.completedOn !== undefined) {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Completed'
      } else if (assessment.startedOn !== undefined) {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Started'
      } else {
        tableRow[displayNames[taskId]?.name ?? taskId] = 'Assigned'
      }
    }
    return tableRow
  })
  exportCsv(computedExportData, `roar-progress-${_kebabCase(administrationInfo.value.name)}-${_kebabCase(orgInfo.value.name)}.csv`);
}

const displayNames = {
  "swr": { name: "Word", order: 3 },
  "swr-es": { name: "Palabra", order: 4 },
  "pa": { name: "Phoneme", order: 2 },
  "sre": { name: "Sentence", order: 5 },
  "letter": { name: "Letter", order: 1 },
  "multichoice": { name: "Multichoice", order: 6 },
  "anb": { name: "ANB", order: 7 },
  "mep": { name: "MEP", order: 8 },
  "mep-pseudo": { name: "MEP-Pseudo", order: 9 },
  "morphology": { name: "Morphology", order: 10 },
}

const columns = computed(() => {
  if (assignmentData.value === undefined) return [];

  const tableColumns = [
    { field: "user.username", header: "Username", dataType: "text", pinned: true },
    { field: "user.name.first", header: "First Name", dataType: "text" },
    { field: "user.name.last", header: "Last Name", dataType: "text" },
    { field: "user.studentData.grade", header: "Grade", dataType: "text" },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: "user.schoolName", header: "School", dataType: "text" })
  }

  if (authStore.isUserSuperAdmin) {
    tableColumns.push({ field: "user.assessmentPid", header: "PID", dataType: "text" });
  }

  if (tableData.value.length > 0) {
    const sortedTasks = Object.keys(tableData.value[0].status).sort((p1, p2) => {
      if (Object.keys(displayNames).includes(p1) && Object.keys(displayNames).includes(p2)) {
        return displayNames[p1].order - displayNames[p2].order
      } else {
        return -1
      }
    })
    for (const taskId of sortedTasks) {
      tableColumns.push({
        field: `status.${taskId}.value`,
        header: displayNames[taskId]?.name ?? taskId,
        dataType: "text",
        tag: true,
        severityField: `status.${taskId}.severity`,
        iconField: `status.${taskId}.icon`
      });
    }
  }
  return tableColumns;
});

const tableData = computed(() => {
  if (assignmentData.value === undefined) return [];

  return assignmentData.value.map(({ user, assignment }) => {
    const status = {};
    for (const assessment of (assignment?.assessments || [])) {
      if (assessment.completedOn !== undefined) {
        status[assessment.taskId] = {
          value: "completed",
          icon: "pi pi-check",
          severity: "success",
        };
      } else if (assessment.startedOn !== undefined) {
        status[assessment.taskId] = {
          value: "started",
          icon: "pi pi-exclamation-triangle",
          severity: "warning",
        };
      } else {
        status[assessment.taskId] = {
          value: "assigned",
          icon: "pi pi-times",
          severity: "danger",
        };
      }
    }
    // If this is a district score report, grab school information
    if (props.orgType === 'district') {
      // Grab user's school list
      const currentSchools = _get(user, 'schools.current')
      if (currentSchools.length) {
        const schoolId = currentSchools[0]
        const schoolName = _get(_find(schoolsInfo.value, school => school.id === schoolId), 'name')
        return {
          user: {
            ...user,
            schoolName
          },
          assignment,
          status,
        }
      }
    }
    return {
      user,
      assignment,
      status,
    }
  });
})

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
})
</script>

<style>
.p-button {
  margin: 0px 8px;
}

.loading-container {
  text-align: center;
}
</style>
