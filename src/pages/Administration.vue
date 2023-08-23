<template>
  <div class="card" id="rectangle" v-if="formReady">
    <RoarDataTable :data="data" :columns="columns" />
  </div>
  <div v-else class="loading-container">
    <AppSpinner style="margin-bottom: 1rem;" />
    <span>Loading Administration Data</span>
  </div>
</template>

<script setup>
import { ref } from 'vue';

let selectedData = ref([]);

const columns = ref([
  { field: "student", header: "Student", dataType: "text" },
  { field: "pid", header: "PID", dataType: "text" },
  { field: "status.swr.value", header: "SWR", dataType: "text", chip: true, severityField: "status.swr.severity", iconField: "status.swr.icon" },
  { field: "status.sre.value", header: "SRE", dataType: "text", chip: true, severityField: "status.sre.severity", iconField: "status.sre.icon" },
  { field: "status.pa.value", header: "PA", dataType: "text", chip: true, severityField: "status.pa.severity", iconField: "status.pa.icon" },
]);
</script>

<style>
.p-button {
  margin: 0px 8px;
}
</style>
