<template>
  <div v-if="!queryStore.runsReady">
    <PvProgressBar :value="percentComplete" />
    <SkeletonTable />
  </div>
  <div v-else style="height: 55vh">
    <RoarDataTable :data="queryStore.runs" :columns="tableColumns" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
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
    "field": "group.id",
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