<template>
  <h2 class="header-text">{{ _toUpper(taskName) }} SCORE TABLE</h2>
  <RoarDataTable
    :columns="columns"
    :data="students"
    :page-limit="pageLimit"
    :loading="isLoading"
    :allow-filtering="false"
    @export-all="exportAll"
    @export-selected="exportSelected"
  />
</template>
<script setup>
import { computed, ref } from 'vue';
import _kebabCase from 'lodash/kebabCase';
import _toUpper from 'lodash/toUpper';
import { exportCsv } from '@/helpers/query/utils';
import RoarDataTable from '@/components/RoarDataTable';
import useAdministrationTaskSubscoresQuery from '@/composables/queries/useAdministrationTaskSubscoresQuery';

const props = defineProps({
  administrationId: { type: String, default: '' },
  // Task UUID — the subscores endpoint is keyed by UUID (not the slug). Resolved
  // upstream from the report's task metadata; null until that loads.
  taskUuid: { type: String, default: '' },
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  orgType: { type: String, default: '' },
  orgId: { type: String, default: '' },
  administrationName: { type: String, default: '' },
  orgName: { type: String, default: '' },
});

const pageLimit = ref(10);

// The server computes the per-task subscore breakdown and declares its columns,
// so the table renders from `subscoreColumns` instead of hard-coding column lists
// per task slug. Gating (token + ids) lives in the composable.
const { data: subscoreData, isLoading } = useAdministrationTaskSubscoresQuery(
  computed(() => props.administrationId),
  computed(() => props.taskUuid),
  computed(() => props.orgType),
  computed(() => props.orgId),
);

const students = computed(() => subscoreData.value?.students ?? []);
const subscoreColumns = computed(() => subscoreData.value?.subscoreColumns ?? []);

const columns = computed(() => {
  const rows = students.value;
  const tableColumns = [];

  // Always include identity columns to prevent layout shift during load.
  // Show all possible identity columns if any data exists; during initial load,
  // include them to stabilize the layout.
  if (rows.length > 0 || isLoading.value) {
    // Only add if at least one row has the field, or during loading to stabilize layout
    if (rows.length === 0 || rows.find((row) => row.user?.username)) {
      tableColumns.push({ field: 'user.username', header: 'Username', dataType: 'text', pinned: true, sort: true });
    }
    if (rows.length === 0 || rows.find((row) => row.user?.email)) {
      tableColumns.push({ field: 'user.email', header: 'Email', dataType: 'text', pinned: true, sort: true });
    }
    if (rows.length === 0 || rows.find((row) => row.user?.firstName)) {
      tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true });
    }
    if (rows.length === 0 || rows.find((row) => row.user?.lastName)) {
      tableColumns.push({ field: 'user.lastName', header: 'Last Name', dataType: 'text', sort: true });
    }
  }

  tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true });
  if (props.orgType === 'district') {
    tableColumns.push({ field: 'user.schoolName', header: 'School', dataType: 'text', sort: true });
  }

  // One column per server-declared subscore; values are looked up by key from each
  // row's `subscores` map. Sort is disabled uniformly because cells mix display
  // strings ("15/19", comma lists) and numbers. In a future PR, the backend's
  // TaskSubscoreColumnSchema could expose value types to enable per-column sorting.
  for (const column of subscoreColumns.value) {
    tableColumns.push({ field: `subscores.${column.key}`, header: column.label, dataType: 'text', sort: false });
  }
  return tableColumns;
});

// Build CSV rows from the same server data: student identity columns + one column
// per declared subscore (keyed by label).
const buildExportRows = (rows) =>
  rows.map(({ user, subscores }) => {
    const tableRow = {
      Username: user?.username,
      First: user?.firstName,
      Last: user?.lastName,
      Grade: user?.grade,
    };
    if (props.orgType === 'district') {
      tableRow.School = user?.schoolName;
    }
    for (const column of subscoreColumns.value) {
      tableRow[column.label] = subscores?.[column.key] ?? '';
    }
    return tableRow;
  });

const exportSelected = (selectedRows) => {
  exportCsv(buildExportRows(selectedRows), `roar-scores-${_kebabCase(props.taskId)}-selected.csv`);
};

const exportAll = () => {
  exportCsv(
    buildExportRows(students.value),
    `roar-scores-${_kebabCase(props.taskId)}-${_kebabCase(props.administrationName)}-${_kebabCase(props.orgName)}.csv`,
  );
};
</script>
<style>
.header-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
}
</style>
