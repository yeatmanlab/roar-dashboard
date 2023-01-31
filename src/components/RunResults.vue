<template>
  <div v-if="!queryStore.runsReady">
    <ProgressBar :value="percentComplete" />
    <SkeletonTable />
  </div>
  <div v-else style="height: 55vh">
    <div class="flex flex-row align-content-center">
      <span class="flex-grow-1 flex align-items-start align-content-center text-align-left">
        <b class="align-self-center ml-1">Select runs below to export</b>
      </span>
      <Button
        icon="pi pi-external-link"
        :label="queryStore.selectedRuns.length !== 0 ? 'Export Selected Runs' : 'Select runs to enable export'"
        class="flex-none mb-1 ml-2 p-2"
        :loading="queryStore.selectedRuns.length === 0"
        :disabled="queryStore.selectedRuns.length === 0"
        @click="exportCSV"
      />
    </div>
    <DataTable
      :value="queryStore.runs"
      ref="runtable"
      :rowHover="true"
      removableSort
      sortMode="multiple"
      scrollHeight="50vh"
      :reorderableColumns="true"
      :resizableColumns="true" columnResizeMode="fit" showGridlines
      :virtualScrollerOptions="{ itemSize: 44 }"
      :row="10"
      dataKey="runId"
      v-model:selection="selectedRuns"
      v-model:filters="filters" filterDisplay="menu"
    >
      <template #empty>
        No runs found.
      </template>
      <template #loading>
        Loading run data. Please wait.
      </template>
      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>

      <Column field="roarUid" header="roarUid" sortable style="min-width: 8rem">
        <template #body="{data}">
          {{data.roarUid}}
        </template>
        <template #filter="{filterModel}">
          <InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search by roarUid"/>
        </template>
      </Column>

      <Column field="runId" header="runId" sortable style="min-width: 10rem">
        <template #body="{data}">
          {{data.runId}}
        </template>
        <template #filter="{filterModel}">
          <InputText type="text" v-model="filterModel.value" class="p-column-filter" placeholder="Search by runId"/>
        </template>
      </Column>

      <Column
        header="taskId" filterField="task"
        sortField="task.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.task.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">Task Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runTasks"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        header="variantId" filterField="variant"
        sortField="variant.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.variant.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">Variant Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runVariants"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        header="districtId" filterField="district"
        sortField="district.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.district.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">District Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runDistricts"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        header="schoolId" filterField="school"
        sortField="school.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.school.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">School Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runSchools"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        header="classId" filterField="class"
        sortField="class.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.class.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">Class Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runClasses"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column
        header="studyId" filterField="study"
        sortField="study.id" sortable
        :showFilterMatchModes="false" :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem"
      >
        <template #body="{data}">
          {{data.study.id}}
        </template>
        <template #filter="{filterModel}">
          <div class="mb-3 font-bold">Study Picker</div>
          <MultiSelect
            v-model="filterModel.value"
            :options="runStudies"
            optionLabel="id"
            placeholder="Any"
            :showToggleAll="false"
            class="p-column-filter"
          />
        </template>
      </Column>

      <Column field="timeStarted" header="timeStarted" sortable dataType="date" style="min-width: 8rem">
        <template #body="{data}">
          {{data.timeStarted}}
        </template>
        <template #filter="{filterModel}">
          <Calendar v-model="filterModel.value" dateFormat="mm/dd/yy" placeholder="mm/dd/yyyy" />
        </template>
      </Column>

      <Column field="timeFinished" header="timeFinished" sortable dataType="date" style="min-width: 8rem">
        <template #body="{data}">
          {{data.timeFinished}}
        </template>
        <template #filter="{filterModel}">
          <Calendar v-model="filterModel.value" dateFormat="mm/dd/yy" placeholder="mm/dd/yyyy" />
        </template>
      </Column>

      <Column field="completed" header="completed" sortable
        :showAddButton="false" :showFilterOperator="false" :showFilterMatchModes="false"
        :filterMenuStyle="{'width':'12rem'}"
        style="min-width: 6rem">
        <template #body="{data}">
          <Chip v-if="data.completed" label="completed" icon="pi pi-check-circle" />
          <Chip v-else label="incomplete" icon="pi pi-times-circle" />
        </template>
        <template #filter="{filterModel}">
          <div class="field-checkbox">
            <Checkbox inputId="completedcheck" v-model="filterModel.value" :binary="true" />
            <label for="completedcheck">Require completed</label>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { FilterMatchMode, FilterOperator } from "primevue/api";
import { storeToRefs } from 'pinia';
import Papa from "papaparse";
import { flattenObj } from '@/helpers';
import { useQueryStore } from "@/store/query";
import SkeletonTable from "@/components/SkeletonTable.vue";

const queryStore = useQueryStore();
const {
  percentCompleteRuns,
  selectedRuns,
  runTasks,
  runVariants,
  runDistricts,
  runSchools,
  runClasses,
  runStudies,
} = storeToRefs(queryStore);
const runtable = ref();

const exportCSV = async () => {
  const csv = Papa.unparse(selectedRuns.value.map(flattenObj));
  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = 'runs.csv';
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
    
const percentComplete = ref(0);
const interval = ref(null);
const startProgress = () => {
  interval.value = setInterval(() => {
    percentComplete.value = Math.round(percentCompleteRuns.value);
  }, 1000);
};
const endProgress = () => {
  clearInterval(interval.value);
  interval.value = null;
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
  study: { value: null, matchMode: FilterMatchMode.IN },
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