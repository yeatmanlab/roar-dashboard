<template>
  <div class="flex flex-row align-content-center">
    <span class="flex-grow-1 flex align-items-start align-content-center text-align-left">
      <b class="align-self-center ml-1">Select students below to export</b>
    </span>
    <PvButton
      icon="pi pi-external-link"
      :label="
        scoreStore.selectedStudents.length !== 0 ? 'Export Selected Students' : 'Select students to enable export'
      "
      class="flex-none mb-1 ml-2 p-2"
      :loading="scoreStore.selectedStudents.length === 0"
      :disabled="scoreStore.selectedStudents.length === 0"
      @click="exportSelectedCSV"
    />
    <PvButton
      icon="pi pi-external-link"
      label="Export All"
      class="flex-none mb-1 ml-2 p-2"
      :loading="queryStore.selectedRuns.length === 0"
      :disabled="scoreStore.selectedRuns.length === 0"
      @click="exportAllCSV"
    />
  </div>
  <!-- TODO: Needs to be replaced with RoarDataTable -->
  <PvDataTable
    ref="runtable"
    v-model:selection="selectedStudents"
    v-model:filters="filters"
    :value="scoreStore.tableRoarScores"
    :row-hover="true"
    removable-sort
    sort-mode="multiple"
    scroll-height="50vh"
    :reorderable-columns="true"
    :resizable-columns="true"
    column-resize-mode="fit"
    show-gridlines
    :virtual-scroller-options="{ itemSize: 44 }"
    :row="10"
    data-key="runId"
    filter-display="menu"
  >
    <template #empty> No students found. </template>
    <template #loading> Loading ROAR scores. Please wait. </template>
    <PvColumn field="studentId" header="Student ID" sortable style="min-width: 8rem">
      <template #body="{ colData }">
        {{ colData.studentId }}
      </template>
      <template #filter="{ filterModel }">
        <PvInputText
          v-model="filterModel.value"
          type="text"
          class="p-column-filter"
          placeholder="Search by student ID"
        />
      </template>
    </PvColumn>

    <PvColumn
      header="Grade"
      field="grade"
      sortable
      :show-filter-match-modes="false"
      :filter-menu-style="{ width: '12rem' }"
      style="min-width: 6rem"
    >
      <template #body="{ colData }">
        {{ colData.grade }}
      </template>
      <template #filter="{ filterModel }">
        <div class="mb-3 font-bold">Grade Picker</div>
        <PvMultiSelect
          v-model="filterModel.value"
          :options="grades"
          option-label="id"
          placeholder="Any"
          :show-toggle-all="false"
          class="p-column-filter"
        />
      </template>
    </PvColumn>

    <PvColumn
      header="age"
      field="age"
      sortable
      :show-filter-match-modes="false"
      :filter-menu-style="{ width: '12rem' }"
      style="min-width: 6rem"
    >
      <template #body="{ colData }">
        {{ colData.age }}
      </template>
      <template #filter="{ filterModel }">
        <div class="mb-3 font-bold">Age Picker</div>
        <PvMultiSelect
          v-model="filterModel.value"
          :options="ages"
          option-label="id"
          placeholder="Any"
          :show-toggle-all="false"
          class="p-column-filter"
        />
      </template>
    </PvColumn>

    <!-- <th>SWR Score</th>
    <th>Estimated WJ standard score</th>
    <th>Estimated WJ percentile rank</th>
    <th>Estimated risk level</th> -->
  </PvDataTable>
</template>

<script setup>
import { ref } from 'vue';
import { FilterMatchMode, FilterOperator } from '@primevue/core/api';
import PvButton from 'primevue/button';
import PvColumn from 'primevue/column';
import PvDataTable from 'primevue/datatable';
import PvInputText from 'primevue/inputtext';
import PvMultiSelect from 'primevue/multiselect';
import { storeToRefs } from 'pinia';
import Papa from 'papaparse';
import { flattenObj } from '@/helpers';
import { useScoreStore } from '@/store/scores';

const scoreStore = useScoreStore();

const { tableRoarScores, selectedStudents } = storeToRefs(scoreStore);

const runtable = ref();

const exportAllCSV = async () => {
  const csv = Papa.unparse(tableRoarScores.value.map(flattenObj));
  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = 'roar_scores.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const exportSelectedCSV = async () => {
  const csv = Papa.unparse(selectedStudents.value.map(flattenObj));
  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = 'roar_scores_selected.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const filters = ref({
  roarUid: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
  },
  runId: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.STARTS_WITH }],
  },
  task: { value: null, matchMode: FilterMatchMode.IN },
  variant: { value: null, matchMode: FilterMatchMode.IN },
  district: { value: null, matchMode: FilterMatchMode.IN },
  school: { value: null, matchMode: FilterMatchMode.IN },
  class: { value: null, matchMode: FilterMatchMode.IN },
  group: { value: null, matchMode: FilterMatchMode.IN },
  timeStarted: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }],
  },
  timeFinished: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.DATE_IS }],
  },
  completed: {
    operator: FilterOperator.AND,
    constraints: [{ value: null, matchMode: FilterMatchMode.IS }],
  },
});
</script>
