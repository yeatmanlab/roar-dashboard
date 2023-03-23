<template>
  <div v-if="!queryStore.runsReady">
    <ProgressBar :value="percentComplete" />
    <SkeletonTable />
  </div>
  <div v-else style="height: 55vh">
    <RoarDataTable :data="getComputedData(queryStore.runs)" :columns="tableColumns" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import _forEach from 'lodash/forEach'
import _map from 'lodash/map'
import _get from 'lodash/get'
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
    "useMultiSelect": true,
  },
  {
    "field": "school",
    "dataType": "text"
  },
  {
    "field": "district",
    "dataType": "text"
  },
  {
    "field": "variant",
    "dataType": "text"
  },
  {
    "field": "study",
    "dataType": "text"
  },
  {
    "field": "class",
    "dataType": "text"
  },
  {
    "field": "task",
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

function getComputedData(runs) {
  let computedData = _map(runs, run => {
    //flatten task, district, school, study, varient from object to value
    if(_get(run, 'task.id') !== undefined) run['task'] = _get(run, 'task.id');
    if(_get(run, 'district.id') !== undefined) run['district'] = _get(run, 'district.id');
    if(_get(run, 'school.id') !== undefined) run['school'] = _get(run, 'school.id');
    if(_get(run, 'study.id') !== undefined) run['study'] = _get(run, 'study.id');
    if(_get(run, 'variant.id') !== undefined) run['variant'] = _get(run, 'variant.id');
    if(_get(run, 'class.id') !== undefined) run['class'] = _get(run, 'class.id');
    return run
  });
  return computedData
}
</script>