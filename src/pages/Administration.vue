<script setup lang="ts">
import { ref } from "vue";
import DataTable from 'datatables.net-vue3';
import DataTablesCore from 'datatables.net';
import moment from "moment";
import "moment-timezone";
import { Timestamp } from "firebase-admin/firestore";
 
DataTable.use(DataTablesCore);

const DATE_AND_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss.SSS z";
const DATE_FORMAT = "YYYY-MM-DD";
const data = ref([
  ["PID_1245", 1691469008099, 1691469018099, ""],
  ["PID_1013", 1691469013099, 1691469018099, ""],
  ["PID_1259", 1691469018000, 1691469018099, ""],
  ["PID_1111", 1691468018099, 1691469018099, ""],
  ["PID_1467", 1691469918099, 1691469018099, ""],
]);

for (let i = 0; i < 50; i++) {
  const minDate = new Date(2023, 0, 1);
  const maxDate = new Date();
  const days = Math.floor(Math.random() * 30);
  const pid = Math.floor(Math.random() * (9999 - 1000) + 1000);
  const assigned = new Date(minDate.getTime() + Math.random() * (maxDate.getTime() - minDate.getTime()));
  const completed = new Date(assigned.getTime() + days * 24 * 60 * 60 * 1000);
  const row = ["PID_" + pid.toString(), assigned.getTime(), completed.getTime(), ""];
  data.value.push(row);
}

for (let i = 0; i < data.value.length; i++) {
  for (let j = 1; j <= 2; j++) {
    data.value[i][j] = new Date(data.value[i][j]).toDateString();;
  }
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
  <DataTable :data="data" class="display">
    <thead>
      <tr>
        <th>PID</th>
        <th>Assigned</th>
        <th>Completed</th>
        <th>Actions</th>
      </tr>
    </thead>
  </DataTable>
</template>

<style>
@import 'datatables.net-dt';
</style>