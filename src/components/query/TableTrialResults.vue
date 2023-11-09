<template>
  <div v-if="!queryStore.trialsReady">
    <PvProgressBar :value="percentComplete" />
    <SkeletonTable />
  </div>
  <div v-else style="height: 55vh">
    <div class="flex flex-row align-content-center">
      <span class="flex-grow-1 flex align-items-start align-content-center text-align-left">
        <b class="align-self-center ml-1">Select trials below to export specific trials</b>
      </span>
      <PvButton
icon="pi pi-external-link"
        :label="queryStore.selectedTrials.length !== 0 ? 'Export Selected Trials' : 'Select trials to enable export'"
        class="flex-none mb-1 ml-2 p-2" :loading="queryStore.selectedTrials.length === 0"
        :disabled="queryStore.selectedTrials.length === 0" @click="exportSelectedCSV" />
      <PvButton icon="pi pi-external-link" label="Export All Trials" class="flex-none mb-1 ml-2 p-2" @click="exportCSV" />
    </div>
    <PvDataTable
ref="trialtable" v-model:selection="selectedTrials" :value="queryStore.trials" :row-hover="true" removable-sort
      sort-mode="multiple" scroll-height="50vh" :reorderable-columns="true" :resizable-columns="true" column-resize-mode="fit"
      show-gridlines :virtual-scroller-options="{ itemSize: 44 }" :row="10" data-key="runId">
      <template #empty>
        No trials found.
      </template>
      <template #loading>
        Loading trial data. Please wait.
      </template>
      <PvColumn selection-mode="multiple" header-style="width: 3rem"></PvColumn>

      <PvColumn
v-for="col of queryStore.trialColumns" :key="col.field" :field="col.field" :header="col.header"
        sortable />
    </PvDataTable>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import Papa from "papaparse";
import { flattenObj } from '@/helpers';
import { useQueryStore } from "@/store/query";
import SkeletonTable from "@/components/SkeletonTable.vue";

export default {
  setup() {
    const queryStore = useQueryStore();
    const {
      percentCompleteTrials,
      selectedTrials,
    } = storeToRefs(queryStore);
    const trialtable = ref();

    const exportSelectedCSV = async () => {
      const csv = Papa.unparse(selectedTrials.value.map(flattenObj));
      const blob = new Blob([csv]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob, { type: 'text/plain' });
      a.download = 'trials.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    const exportCSV = async () => {
      const csv = Papa.unparse(queryStore.trials.map(flattenObj));
      const blob = new Blob([csv]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob, { type: 'text/plain' });
      a.download = 'trials.csv';
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
        percentComplete.value = Math.round(percentCompleteTrials.value);
      }, 1000);
    };
    const endProgress = () => {
      clearInterval(interval.value);
      interval.value = null;
    };

    return {
      SkeletonTable,
      exportCSV,
      exportSelectedCSV,
      percentComplete,
      queryStore,
      selectedTrials,
      trialtable,
    };
  }
}

</script>