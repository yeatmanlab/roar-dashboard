<template>
  <div class="flex flex-row align-content-center">
    <span class="flex-grow-1 flex align-items-start align-content-center text-align-left">
      <b class="align-self-center ml-1">Select students below to export</b>
    </span>
    <Button icon="pi pi-external-link"
      :label="scoreStore.selectedStudents.length !== 0 ? 'Export Selected Students' : 'Select students to enable export'"
      class="flex-none mb-1 ml-2 p-2" :loading="scoreStore.selectedStudents.length === 0"
      :disabled="scoreStore.selectedStudents.length === 0" @click="exportSelectedCSV" />
    <Button icon="pi pi-external-link" label="Export All" class="flex-none mb-1 ml-2 p-2"
      :loading="queryStore.selectedRuns.length === 0" :disabled="scoreStore.selectedRuns.length === 0"
      @click="exportAllCSV" />
  </div>
  <!-- TODO: Needs to be replaced with RoarDataTable -->
  <DataTable :value="scoreStore.tableRoarScores" ref="runtable" :rowHover="true" removableSort sortMode="multiple"
    scrollHeight="50vh" :reorderableColumns="true" :resizableColumns="true" columnResizeMode="fit" showGridlines
    :virtualScrollerOptions="{ itemSize: 44 }" :row="10" dataKey="runId" v-model:selection="selectedStudents"
    v-model:filters="filters" filterDisplay="menu">
    <template #empty>
      No students found.
    </template>
    <template #loading>
      Loading ROAR scores. Please wait.
    </template>
    <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

    <Column field="studentId" header="Student ID" sortable style="min-width: 8rem">
      <template #body="{ data }">
        {{ data.studentId }}
      </template>
      <template #filter="{ filterModel }">
        <InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search by student ID" />
      </template>
    </Column>

    <Column header="Grade" field="grade" sortable :showFilterMatchModes="false" :filterMenuStyle="{ 'width': '12rem' }"
      style="min-width: 6rem">
      <template #body="{ data }">
        {{ data.grade }}
      </template>
      <template #filter="{ filterModel }">
        <div class="mb-3 font-bold">Grade Picker</div>
        <MultiSelect v-model="filterModel.value" :options="grades" optionLabel="id" placeholder="Any"
          :showToggleAll="false" class="p-column-filter" />
      </template>
    </Column>

    <Column header="age" field="age" sortable :showFilterMatchModes="false" :filterMenuStyle="{ 'width': '12rem' }"
      style="min-width: 6rem">
      <template #body="{ data }">
        {{ data.age }}
      </template>
      <template #filter="{ filterModel }">
        <div class="mb-3 font-bold">Age Picker</div>
        <MultiSelect v-model="filterModel.value" :options="ages" optionLabel="id" placeholder="Any"
          :showToggleAll="false" class="p-column-filter" />
      </template>
    </Column>

    <!-- <th>SWR Score</th>
    <th>Estimated WJ standard score</th>
    <th>Estimated WJ percentile rank</th>
    <th>Estimated risk level</th> -->
  </DataTable>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { FilterMatchMode, FilterOperator } from "primevue/api";
import { storeToRefs } from 'pinia';
import Papa from "papaparse";
import { flattenObj } from '@/helpers';
import { useScoreStore } from "@/store/scores";

const data = [
  {
    "id": "1",
    "pid": "demo-1",
    "grade": 6,
    "age": 11,
    "roarScore": 561,
    "wjStandardScore": 104,
    "wjPercentile": 61,
    "riskLevel": "At or Above Average",
  },
  {
    "id": "2",
    "pid": "demo-2",
    "grade": 7,
    "age": 12,
    "roarScore": 306,
    "wjStandardScore": 78,
    "wjPercentile": 7,
    "riskLevel": "Needs Extra Support",
  },
  {
    "id": "3",
    "pid": "demo-3",
    "grade": 7,
    "age": 12,
    "roarScore": 501,
    "wjStandardScore": 94,
    "wjPercentile": 34,
    "riskLevel": "Needs Some Support",
  },
];

const scoreStore = useScoreStore();

const {
  tableRoarScores,
  selectedStudents,
} = storeToRefs(scoreStore);

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

onMounted(() => {
  startProgress();
})

onBeforeUnmount(() => {
  endProgress();
})

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