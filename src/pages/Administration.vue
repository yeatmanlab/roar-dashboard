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
import { useAuthStore } from '../store/auth';
import { useQueryStore } from '../store/query';

const authStore = useAuthStore();
const queryStore = useQueryStore();

const props = defineProps({
  administrationId: String,
  orgType: String,
  orgId: String,
});

const refreshing = ref(true);
const data = ref([]);

const columns = ref([
  { field: "student", header: "Student", dataType: "text" },
  { field: "pid", header: "PID", dataType: "text" },
  { field: "status.swr.value", header: "SWR", dataType: "text", chip: true, severityField: "status.swr.severity", iconField: "status.swr.icon" },
  { field: "status.sre.value", header: "SRE", dataType: "text", chip: true, severityField: "status.sre.severity", iconField: "status.sre.icon" },
  { field: "status.pa.value", header: "PA", dataType: "text", chip: true, severityField: "status.pa.severity", iconField: "status.pa.icon" },
]);

let unsubscribe;

const refresh = async () => {
  refreshing.value = true;
  if (unsubscribe) unsubscribe();

  data.value = await queryStore.getUsersByAssignment(
    props.administrationId, props.orgType, props.orgId, false
  );

  console.log('Refreshed data', { data: data.value })

  refreshing.value = false;
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  console.log('State mutated', mutation, state);
  if (state.roarfirekit.getUsersByAssignment && state.roarfirekit.isAdmin()) {
    console.log('Refreshing');
    await refresh();
  }
});

</script>

<style>
.p-button {
  margin: 0px 8px;
}
</style>
