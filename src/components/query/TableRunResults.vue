<template>
  <div v-if="!queryStore.runsReady">
    <ProgressBar :value="percentComplete" />
    <SkeletonTable />
  </div>
  <div v-else style="height: 55vh">
    <RoarDataTable :data="queryStore.runs" :columns="tableColumns" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import _forEach from 'lodash/forEach'
import _map from 'lodash/map'
import _get from 'lodash/get'
import _set from 'lodash/set'
import { useQueryStore } from "@/store/query";
import SkeletonTable from "@/components/SkeletonTable.vue";

const queryStore = useQueryStore();
const { percentCompleteRuns } = storeToRefs(queryStore);

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

const tableColumns = ref([
  {
    "field": "roarUid", 
    "header": "Roar Id", 
    "allowMultipleFilters": true,
    "dataType": "text"
  },
  {
    "field": "runId", 
    "header": "Run Id", 
    "allowMultipleFilters": true,
    "dataType": "text"
  },
  {
    "field": "completed",
    "header": "Completed",
    "dataType": "boolean",
  },
  {
    "field": "school.id",
    "dataType": "text"
  },
  {
    "field": "district.id",
    "dataType": "text"
  },
  {
    "field": "variant.id",
    "dataType": "text"
  },
  {
    "field": "study.id",
    "dataType": "text"
  },
  {
    "field": "class.id",
    "dataType": "text"
  },
  {
    "field": "task.id",
    "header": "Task ID",
    "useMultiSelect": true,
    "dataType": "text"
  },
  {
    "field": "timeStarted",
    "header": "Time Started",
    "sort": true,
    "dataType": "date"
  },
  {
    "field": "timeFinished",
    "header": "Time Finished",
    "sort": true,
    "dataType": "date"
  }
]);
</script>