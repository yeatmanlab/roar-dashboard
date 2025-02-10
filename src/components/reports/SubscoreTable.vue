<template>
  <h2 class="header-text">{{ _toUpper(taskName) }} SCORE TABLE</h2>
  <RoarDataTable
    :columns="columns"
    :data="computedTableData"
    :page-limit="pageLimit"
    :allow-filtering="false"
    @export-all="exportAll"
    @export-selected="exportSelected"
  />
</template>
<script setup>
import { computed, ref, onMounted } from 'vue';
import _get from 'lodash/get';
import _kebabCase from 'lodash/kebabCase';
import _set from 'lodash/set';
import _toUpper from 'lodash/toUpper';
import { exportCsv } from '@/helpers/query/utils';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import RoarDataTable from '@/components/RoarDataTable';

const props = defineProps({
  administrationId: { type: String, required: true, default: '' },
  computedTableData: {
    type: Array,
    required: true,
    default: () => [],
  },
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  orgType: { type: String, required: true, default: '' },
  orgId: { type: String, required: true, default: '' },
  administrationName: { type: String, required: true, default: '' },
  orgName: { type: String, required: true, default: '' },
});

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);

const initialized = ref(false);

const pageLimit = ref(10);

const columns = computed(() => {
  const tableColumns = [];
  if (props.computedTableData.find((assignment) => assignment.user?.username)) {
    tableColumns.push({
      field: 'user.username',
      header: 'Username',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.email)) {
    tableColumns.push({
      field: 'user.email',
      header: 'Email',
      dataType: 'text',
      pinned: true,
      sort: true,
      filter: true,
    });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.firstName)) {
    tableColumns.push({ field: 'user.firstName', header: 'First Name', dataType: 'text', sort: true, filter: true });
  }
  if (props.computedTableData.find((assignment) => assignment.user?.lastName)) {
    tableColumns.push({ field: 'user.lastName', header: 'Last Name', dataType: 'text', sort: true, filter: true });
  }
  tableColumns.push({ field: 'user.grade', header: 'Grade', dataType: 'text', sort: true, filter: true });

  if (props.orgType === 'district') {
    tableColumns.push({
      field: 'user.schoolName',
      header: 'School',
      dataType: 'text',
      sort: true,
      filter: true,
    });
  }
  console.log('props.taskId', props.taskId);
  if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
    console.log('exporting letter data', props.taskId);
    tableColumns.push(
      { field: `scores.${props.taskId}.lowerCaseScore`, header: 'Lower Case', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.upperCaseScore`, header: 'Upper Case', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.phonemeScore`, header: 'Letter Sounds', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.totalScore`, header: 'Total', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.incorrectLetters`, header: 'Letters To Work On', dataType: 'text', sort: false },
      { field: `scores.${props.taskId}.incorrectPhonemes`, header: 'Sounds To Work On', dataType: 'text', sort: false },
    );
  }
  if (props.taskId === 'pa') {
    tableColumns.push(
      { field: 'scores.pa.firstSound', header: 'First Sound', dataType: 'text', sort: false },
      { field: 'scores.pa.lastSound', header: 'Last Sound', dataType: 'text', sort: false },
      { field: 'scores.pa.deletion', header: 'Deletion', dataType: 'text', sort: false },
      { field: 'scores.pa.total', header: 'Total', dataType: 'text', sort: false },
      { field: 'scores.pa.skills', header: 'Skills To Work On', dataType: 'text', sort: false },
    );
  }
  return tableColumns;
});

const exportSelected = (selectedRows) => {
  const computedExportData = selectedRows.map(({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
      _set(tableRow, 'Lower Case', _get(scores, `${props.taskId}.lowerCaseScore`));
      _set(tableRow, 'Upper Case', _get(scores, `${props.taskId}.upperCaseScore`));
      _set(tableRow, 'Letter Sounds', _get(scores, `${props.taskId}.phonemeScore`));
      _set(tableRow, 'Total', _get(scores, `${props.taskId}.totalScore`));
      _set(tableRow, 'Letters To Work On', _get(scores, `${props.taskId}.incorrectLetters`));
      _set(tableRow, 'Sounds To Work On', _get(scores, `${props.taskId}.incorrectPhonemes`));
    }
    if (props.taskId === 'pa') {
      _set(tableRow, 'First Sound', _get(scores, 'pa.firstSound'));
      _set(tableRow, 'Last Sound', _get(scores, 'pa.lastSound'));
      _set(tableRow, 'Deletion', _get(scores, 'pa.deletion'));
      _set(tableRow, 'Total', _get(scores, 'pa.total'));
      _set(tableRow, 'Skills To Work On', _get(scores, 'pa.skills'));
    }
    return tableRow;
  });
  exportCsv(computedExportData, `roar-scores-${_kebabCase(props.taskId)}-selected.csv`);
  return;
};

const exportAll = async () => {
  const computedExportData = props.computedTableData.map(({ user, scores }) => {
    let tableRow = {
      Username: _get(user, 'username'),
      First: _get(user, 'firstName'),
      Last: _get(user, 'lastName'),
      Grade: _get(user, 'grade'),
    };
    if (props.taskId === 'letter' || props.taskId === 'letter-en-ca') {
      _set(tableRow, 'Lower Case', _get(scores, `${props.taskId}.lowerCaseScore`));
      _set(tableRow, 'Upper Case', _get(scores, `${props.taskId}.upperCaseScore`));
      _set(tableRow, 'Letter Sounds', _get(scores, `${props.taskId}.phonemeScore`));
      _set(tableRow, 'Total', _get(scores, `${props.taskId}.totalScore`));
      _set(tableRow, 'Letters To Work On', _get(scores, `${props.taskId}.incorrectLetters`));
      _set(tableRow, 'Sounds To Work On', _get(scores, `${props.taskId}.incorrectPhonemes`));
    } else if (props.taskId === 'pa') {
      _set(tableRow, 'First Sound', _get(scores, 'pa.firstSound'));
      _set(tableRow, 'Last Sound', _get(scores, 'pa.lastSound'));
      _set(tableRow, 'Deletion', _get(scores, 'pa.deletion'));
      _set(tableRow, 'Total', _get(scores, 'pa.total'));
      _set(tableRow, 'Skills To Work On', _get(scores, 'pa.skills'));
    }
    return tableRow;
  });
  exportCsv(
    computedExportData,
    `roar-scores-${_kebabCase(props.taskId)}-${_kebabCase(props.administrationName)}-${_kebabCase(props.orgName)}.csv`,
  );
  return;
};

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
<style>
.header-text {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
}
</style>
