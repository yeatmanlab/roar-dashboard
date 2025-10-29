<template>
  <div class="flex flex-wrap gap-3 p-5 bg-gray-100 rounded flex-column align-items-around">
    <div class="flex gap-1 mx-5 mb-5 flex-column">
      <div class="text-sm text-gray-500 uppercase">Progress by Assessment</div>
      <div
        v-for="{ taskId } of administrationData.assessments"
        :key="taskId"
        class="flex justify-content-between align-items-center"
      >
        <div v-if="tasksDictionary[taskId]" class="w-full text-lg font-bold text-gray-600">
          {{ tasksDictionary[taskId]?.technicalName ?? taskId }}
          <span v-if="tasksDictionary[taskId].name" class="text-sm font-light uppercase">
            ({{ tasksDictionary[taskId]?.publicName }})
          </span>
        </div>
        <div v-else class="w-full text-lg font-bold text-gray-600">
          {{ taskId }}
        </div>
        <PvChart
          type="bar"
          :data="setBarChartData(adminStats[taskId])"
          :options="setBarChartOptions(adminStats[taskId])"
          class="h-2rem lg:w-full"
        />
      </div>
    </div>
    <div class="flex mx-5 flex-column">
      <div class="text-sm text-gray-500 uppercase">Total Assessment Progress</div>
      <div class="flex justify-content-between align-items-center">
        <div class="w-full text-xl font-bold text-gray-600">
          Total
          <span class="text-sm font-light"> ({{ adminStats.assignment.assigned }} total assignments) </span>
        </div>
        <PvChart
          type="bar"
          :data="setBarChartData(adminStats.assignment)"
          :options="setBarChartOptions(adminStats.assignment)"
          class="h-3rem lg:w-full"
        />
      </div>
    </div>
    <ProgressLegend />
  </div>
</template>

<script setup>
import PvChart from 'primevue/chart';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import ProgressLegend from './ProgressLegend.vue';

defineProps({
  adminStats: {
    type: Object,
    required: true,
  },
  administrationData: {
    type: Object,
    required: true,
  },
  tasksDictionary: {
    type: Object,
    required: true,
  },
});
</script>
