<script setup lang="ts">
import { ref, onMounted } from "vue";

import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net';
import 'datatables.net-select';

import moment from "moment";
import "moment-timezone";
import { Timestamp } from "firebase-admin/firestore";
 
DataTable.use(DataTablesCore);

const DATE_FORMAT = "YYYY-MM-DD";
const DATE_AND_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS z";

let dt;
const columns = ref([
  {
    targets: 0,
    data: null,
    defaultContent: '',
    orderable: false,
    className: 'select-checkbox'
  },
  { data: 'pid', title: 'PID' },
  { data: 'assigned', title: 'Assigned' },
  { data: 'completed', title: 'Completed' },
  { 
    data: 'actions',
    title: 'Actions',
    orderable: false,
    defaultContent: `
      <button class="bg-green-700 hover:bg-green-800 text-white font-semibold px-4 border border-gray-400 rounded shadow">
        Remind
      </button>
      <button class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-4 rounded inline-flex items-center">
        Get Report
      </button>
      <button
        @click="remove"
        class="bg-purple-700 hover:bg-purple-800 text-white font-semibold px-4 rounded">
        Delete
      </button>
      `
  },
]);

const data = ref([
  { pid: "PID_1245", assigned: 1691469008099, completed: 1691469018099 },
  { pid: "PID_1013", assigned: 1691469013099, completed: 1691469018099 },
  { pid: "PID_1259", assigned: 1691469018000, completed: 1691469018099 },
  { pid: "PID_1111", assigned: 1691468018099, completed: 1691469018099 },
  { pid: "PID_1467", assigned: 1691469918099, completed: 1691469018099 },
]);

const options = {
  responsive: true,
  select: {
    style:    'multi',
    selector: 'td:first-child'
  }
};

const table = ref();

for (let i = 5; i < 500 ; i++) {
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

// Get a DataTables API reference
onMounted(function () {
  dt = table.value.dt;
});

// For each selected row find the data object in `data` array and remove it
function remove() {
  dt.rows({ selected: true }).every(function () {
    let idx = data.value.indexOf(this.data());
    data.value.splice(idx, 1);
  });
}

function convertTimestamp(timestamp: string | number) {
  // convert from string to a JSON object
  if (typeof timestamp === "string") {
    try {
      timestamp = JSON.parse(timestamp);
    } catch (err: unknown) {
      console.log("Error when parsing timestamp to a JSON object!");
      console.log("Timestamp:", timestamp);
      if (err instanceof Error) {
        console.log("Error message:", err.message);
      }
    }
  }

  return timestamp["_seconds"] * 1000 + timestamp["_nanoseconds"] / 1000000;
}

function convertTimestampToDate(
  timestamp: string | number,
  timezone: string = "America/Los_Angeles"
) {
  // const milliseconds = convertTimestamp(timestamp);
  return moment(timestamp).tz(timezone).format(DATE_AND_TIME_FORMAT);
}

function trimTimeFromDate(date: string) {
  return moment(date, DATE_AND_TIME_FORMAT).format(DATE_FORMAT); // YYYY-MM-DD
}
</script>

<template>
  <h2 class="admin-title">Administration Title</h2>
  <DataTable
    :data="data"
    :columns="columns"
    class="display"
    :options="options"
    ref="table"
  />
  <button
    @click="remove"
    class="bg-purple-700 hover:bg-purple-800 text-white font-semibold px-4 rounded">
    Delete
  </button>
</template>

<style>
@import 'datatables.net-dt';
@import 'https://cdn.datatables.net/select/1.7.0/css/select.dataTables.min.css';
@import 'https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

button {
  margin: 0px 8px;
}

.admin-title {
  font-weight: bold;
  width: 100%;
  padding-bottom: .5rem;
  border-bottom: 1px solid var(--surface-d);
  flex: 1 1 100%;
}
</style>