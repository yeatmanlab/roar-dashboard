<template>
  <div>
    <Button label="Remind" @click="remove" />
    <Button label="Get Report" @click="remove" />
    <Button label="Delete" @click="remove" />
    <RoarDataTable :data="data" :columns="columns" />
  </div>
</template>

<script setup>
import { Vue2ProvideUnheadPlugin } from '@vueuse/head';
import { defineProps, ref } from 'vue';

// We will use a route like
// /administration/:id/:orgType/:orgId

// e.g., /administration/123/class/456

const props = defineProps({
  id: Number,
  orgType: String,
  orgId: String,
});

// Orgs are districts, schools, classes, groups, families.
// Insert logic to build columns dynamically
// The logic here should be that if there is only one org of any type, then display that org name above the table.
// But if there are multiple orgs of any type, then display a column for that org type.
// If an orgType is provided, then filter results to only that org type.

const data = ref([
  { pid: "PID_1245", assigned: 1691469008099, completed: 1691469018099 },
  { pid: "PID_1013", assigned: 1691469013099, completed: 1691469018099 },
  { pid: "PID_1259", assigned: 1691469018000, completed: 1691469018099 },
  { pid: "PID_1111", assigned: 1691468018099, completed: 1691469018099 },
  { pid: "PID_1467", assigned: 1691469918099, completed: 1691469018099 },
]);

let selectedData = ref([]);

const columns = ref([
  { field: "pid", header: "PID", dataType: "text" },
  { field: "assigned", header: "Assigned", dataType: "text" },
  { field: "completed", header: "Completed", dataType: "text" },
]);

for (let i = 5; i < 500; i++) {
  const minDate = new Date(2023, 0, 1);
  const maxDate = new Date();
  const days = Math.floor(Math.random() * 30);
  const pid = Math.floor(Math.random() * (9999 - 1000) + 1000);
  const assigned = new Date(minDate.getTime() + Math.random() * (maxDate.getTime() - minDate.getTime()));
  const completed = new Date(assigned.getTime() + days * 24 * 60 * 60 * 1000);
  const row = {
    pid: "PID_" + pid.toString(),
    assigned: assigned.getTime(),
    completed: completed.getTime(),
  };
  data.value.push(row);
}

for (let i = 0; i < data.value.length; i++) {
  for (const col of ['assigned', 'completed']) {
    data.value[i][col] = new Date(data.value[i][col]).toDateString();
  }
}
</script>

<style>
.p-button {
  margin: 0px 8px;
}
</style>
