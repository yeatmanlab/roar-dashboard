<template>
  <div class="flex flex-wrap gap-3 p-5 bg-gray-100 rounded flex-column align-items-around">
    <div class="chart-grid">
      <div class="chart-section-header">Progress by Assessment</div>

      <template v-for="{ taskId } of administrationData.assessments" :key="taskId">
        <div v-if="tasksDictionary[taskId]" class="chart-label text-lg font-bold text-gray-600">
          <span class="whitespace-nowrap">{{ tasksDictionary[taskId]?.technicalName ?? taskId }}</span>
          <span v-if="tasksDictionary[taskId].name" class="text-sm font-light uppercase label-secondary">
            ({{ tasksDictionary[taskId]?.publicName }})
          </span>
        </div>
        <div v-else class="chart-label whitespace-nowrap text-lg font-bold text-gray-600">
          {{ taskId }}
        </div>
        <PvChart
          type="bar"
          :data="setBarChartData(getTaskStats(taskId))"
          :options="setBarChartOptions(getTaskStats(taskId))"
          class="h-2rem chart-item"
        />
      </template>

      <div class="chart-section-header mt-2">Total Assignment Progress</div>

      <div class="chart-label text-xl font-bold text-gray-600">
        <span class="whitespace-nowrap">Total</span>
        <span class="text-sm font-light label-secondary"> ({{ totalAssignments }} total assignments) </span>
      </div>
      <PvChart
        type="bar"
        :data="setBarChartData(getTotalStats())"
        :options="setBarChartOptions(getTotalStats())"
        class="h-3rem chart-item"
      />
    </div>
    <ProgressLegend />
  </div>
</template>

<script setup>
import PvChart from 'primevue/chart';
import { computed } from 'vue';
import { setBarChartData, setBarChartOptions } from '@/helpers/plotting';
import ProgressLegend from './ProgressLegend.vue';

const props = defineProps({
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

const totalAssignments = computed(() => {
  return (props.adminStats?.assigned || 0) + (props.adminStats?.started || 0) + (props.adminStats?.completed || 0);
});

/**
 * Get stats for a specific task from the new data structure
 * New format: { byTask: { "task-id": { assigned, started, completed } } }
 */
const getTaskStats = (taskId) => {
  // Convert taskId format: "roar-inference" -> "roar-inference" (keep as is)
  // The byTask object uses the taskId directly
  return props.adminStats?.byTask?.[taskId] || { assigned: 0, started: 0, completed: 0 };
};

/**
 * Get total stats from the new data structure
 * New format: { assigned, started, completed, byTask: {...} }
 */
const getTotalStats = () => {
  return {
    assigned: props.adminStats?.assigned || 0,
    started: props.adminStats?.started || 0,
    completed: props.adminStats?.completed || 0,
  };
};
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  row-gap: 0.5rem;
  column-gap: 0.75rem;
  align-items: center;
}

.chart-section-header {
  grid-column: 1 / -1;
  font-size: 0.875rem;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

.chart-label {
  max-width: 400px;
}

.label-secondary {
  display: inline;
}

.chart-item {
  min-width: 0;
}

/* Responsive: wrap publicName on narrower screens */
@media (max-width: 1200px) {
  .chart-label {
    max-width: 300px;
  }

  .label-secondary {
    display: block;
    margin-top: 0.25rem;
  }
}

@media (max-width: 768px) {
  .chart-grid {
    grid-template-columns: minmax(150px, auto) 1fr;
  }

  .chart-label {
    max-width: 200px;
  }
}
</style>
