<template>
  <main class="container main">
    <section class="main-body">
      <div class="flex justify-content-between align-items-center">
        <div>
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

      <div v-if="assignmentData?.length === 0" class="no-scores-container">
        <h3>No scores found.</h3>
        <span
          >The filters applied have no matching scores.
          <PvButton text @click="resetFilters">Reset filters</PvButton>
        </span>
      </div>
      <div v-else-if="assignmentData?.length ?? 0 > 0">
        <RoarDataTable
          v-if="columns?.length ?? 0 > 0"
          :data="tableData"
          :columns="columns"
          :total-records="assignmentCount"
          :loading="isLoadingScores || isFetchingScores"
          :page-limit="pageLimit"
          lazy
          :lazy-pre-sorting="sortDisplay"
          data-cy="roar-data-table"
          :allow-filtering="true"
          @page="onPage($event)"
          @sort="onSort($event)"
          @filter="onFilter($event)"
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
                  option-value="id"
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
import { computed, ref, onMounted, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import _find from 'lodash/find';
import _head from 'lodash/head';
import _tail from 'lodash/tail';
import _get from 'lodash/get';
import _remove from 'lodash/remove';
import _union from 'lodash/union';
import _isEmpty from 'lodash/isEmpty';
import _kebabCase from 'lodash/kebabCase';
import _map from 'lodash/map';
import { useAuthStore } from '@/store/auth';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById, exportCsv } from '../helpers/query/utils';
import { assignmentPageFetcher, assignmentCounter, assignmentFetchAll } from '@/helpers/query/assignments';
import { orgFetcher } from '@/helpers/query/orgs';
import { pluralizeFirestoreCollection } from '@/helpers';
import { useConfirm } from 'primevue/useconfirm';
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
const orderBy = ref([
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'userData.grade',
    },
  },
  {
    direction: 'ASCENDING',
    field: {
      fieldPath: 'userData.name.last',
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

const filterBy = ref([]);
const filterSchools = ref([]);
const filterGrades = ref([]);
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

// Grab grade options for filter dropdown
const gradeOptions = ref([
  {
    value: '1',
    label: '1st Grade',
  },
  {
    value: '2',
    label: '2nd Grade',
  },
  {
    value: '3',
    label: '3rd Grade',
  },
  {
    value: '4',
    label: '4th Grade',
  },
  {
    value: '5',
    label: '5th Grade',
  },
  {
    value: '6',
    label: '6th Grade',
  },
  {
    value: '7',
    label: '7th Grade',
  },
  {
    value: '8',
    label: '8th Grade',
  },
  {
    value: '9',
    label: '9th Grade',
  },
  {
    value: '10',
    label: '10th Grade',
  },
  {
    value: '11',
    label: '11th Grade',
  },
  {
    value: '12',
    label: '12th Grade',
  },
]);

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
  queryKey: ['assignments', props.administrationId, props.orgId, pageLimit, page, filterBy, orderBy],
  queryFn: () =>
    assignmentPageFetcher(
      props.administrationId,
      props.orgType,
      props.orgId,
      pageLimit,
      page,
      false,
      undefined,
      true,
      filterBy.value,
      orderBy.value,
    ),
  keepPreviousData: true,
  enabled: scoreQueryEnabled,
  staleTime: 5 * 60 * 1000, // 5 mins
});

// Scores count query
const { data: assignmentCount } = useQuery({
  queryKey: ['assignments', props.administrationId, props.orgId, filterBy],
  queryFn: () => assignmentCounter(props.administrationId, props.orgType, props.orgId, filterBy.value),
  keepPreviousData: true,
  enabled: scoreQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const onPage = (event) => {
  page.value = event.page;
  pageLimit.value = event.rows;
};

const sortDisplay = computed(() => {
  const display = [];
  for (const sort of orderBy.value) {
    // TODO: TEMPORARY - Make this a dynamic way of converting
    // fields into column paths
    let item = {};
    if (sort.direction === 'ASCENDING') {
      item.order = 1;
    } else {
      item.order = -1;
    }
    const sortFieldPath = sort.field.fieldPath;
    if (sortFieldPath === 'userData.grade') {
      item.field = 'user.studentData.grade';
    } else if (sortFieldPath === 'userData.name.first') {
      item.field = 'user.name.first';
    } else if (sortFieldPath === 'userData.name.last') {
      item.field = 'user.name.last';
    } else if (sortFieldPath === 'userData.username') {
      item.field = 'user.username';
    } else if (sortFieldPath === 'readOrgs.schools') {
      item.field = 'user.schoolName';
    }
    display.push(item);
  }
  return display;
});

const confirm = useConfirm();
const onSort = (event) => {
  const _orderBy = (event.multiSortMeta ?? []).map((item) => {
    let field = item.field.replace('user', 'userData');
    // Due to differences in the document schemas,
    //   fields found in studentData in the user document are in the
    //   top level of the assignments.userData object.
    if (field.split('.')[1] === 'studentData') {
      field = `userData.${field.split('.').slice(2, field.length)}`;
    }
    if (field.split('.')[1] === 'schoolName') {
      field = `readOrgs.schools`;
    }
    return {
      field: { fieldPath: field },
      direction: item.order === 1 ? 'ASCENDING' : 'DESCENDING',
    };
  });
  if (_orderBy.length > 1) {
    confirm.require({
      group: 'sort',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Continue',
      acceptIcon: 'pi pi-check',
      accept: () => {
        console.log('modal closed.');
      },
    });
  } else {
    orderBy.value = !_isEmpty(_orderBy) ? _orderBy : [];
    page.value = 0;
  }
};

watch(filterSchools, (newSchools) => {
  // check if filter entry for schools exists
  const filterSchools = _find(filterBy.value, { collection: 'schools' });
  // Turn off sort when filtering
  orderBy.value = [];
  if (filterSchools) {
    if (_isEmpty(newSchools)) {
      _remove(filterBy.value, { collection: 'schools' });
      return;
    }
    filterSchools.value = _union(filterSchools.value, newSchools);
  } else {
    filterBy.value.push({
      collection: 'schools',
      field: 'assigningOrgs.schools',
      value: newSchools,
    });
  }
});

watch(filterGrades, (newGrades) => {
  // Turn off sort when filtering
  orderBy.value = [];
  filterBy.value.push({
    collection: 'grade',
    field: 'grade',
    value: toRaw(newGrades),
  });
});

const onFilter = (event) => {
  // Turn off sort when filtering
  orderBy.value = [];
  const filters = [];
  for (const filterKey in _get(event, 'filters')) {
    const filter = _get(event, 'filters')[filterKey];
    const constraint = _head(_get(filter, 'constraints'));
    if (_get(constraint, 'value')) {
      const path = filterKey.split('.');
      if (_head(path) === 'user') {
        // Special case for school
        if (path[1] === 'schoolName') {
          // find ID from given name
          const schoolName = constraint.value;
          const schoolEntry = _find(schoolsInfo.value, { name: schoolName });
          if (!_isEmpty(schoolEntry)) {
            filters.push({ value: [schoolEntry.id], collection: 'schools', field: 'assigningOrgs.schools' });
          }
        } else if (path[1] === 'studentData') {
          // Due to differences in the document schemas,
          //   fields found in studentData in the user document are in the
          //   top level of the assignments.userData object.
          filters.push({ ...constraint, collection: 'users', field: path.slice(2, path.length) });
        } else {
          filters.push({ ...constraint, collection: 'users', field: _tail(path).join('.') });
        }
      }
      if (_head(path) === 'status') {
        const taskId = path[1];
        filters.push({
          ...constraint,
          collection: 'assignments',
          taskId: taskId,
          field: 'progress',
        });
      }
    }
  }
  const orgFilter = _find(filterBy.value, { collection: 'schools' });
  const gradeFilter = _find(filterBy.value, { collection: 'grade' });
  if (orgFilter) filters.push(orgFilter);
  if (gradeFilter) filters.push(gradeFilter);
  filterBy.value = filters;
  page.value = 0;
};

const resetFilters = () => {
  filterSchools.value = [];
  filterGrades.value = [];
  filterBy.value = [];
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
      } else if (assessment.optional) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Optional';
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
      } else if (assessment.optional) {
        tableRow[taskDisplayNames[taskId]?.name ?? taskId] = 'Optional';
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
    { field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: true },
    { field: 'user.name.first', header: 'First Name', dataType: 'text', sort: true },
    { field: 'user.name.last', header: 'Last Name', dataType: 'text', sort: true },
    { field: 'user.studentData.grade', header: 'Grade', dataType: 'text', sort: true, filter: false },
  ];

  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: true, filter: false });
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
        dataType: 'progress',
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
      if (assessment.optional) {
        status[assessment.taskId] = {
          value: 'optional',
          icon: 'pi pi-question',
          severity: 'info',
        };
      } else if (assessment.completedOn !== undefined) {
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
const { roarfirekit } = storeToRefs(authStore);
onMounted(async () => {
  if (roarfirekit.value.restConfig) refresh();
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
</style>
