<template>
  <div class="flex flex-wrap gap-3 p-5 bg-gray-100 rounded flex-column align-items-around">
    <div class="chart-grid">
      <div class="chart-section-header">Progress by Assessment</div>

      <template v-for="task of adminStats.byTask" :key="task.taskId">
        <div v-if="tasksDictionary[task.taskSlug]" class="chart-label text-lg font-bold text-gray-600">
          <span class="whitespace-nowrap">{{ tasksDictionary[task.taskSlug]?.nameTechnical ?? task.taskName }}</span>
          <span v-if="tasksDictionary[task.taskSlug].name" class="text-sm font-light uppercase label-secondary">
            ({{ tasksDictionary[task.taskSlug]?.nameSimple }})
          </span>
        </div>
        <div v-else class="chart-label whitespace-nowrap text-lg font-bold text-gray-600">
          {{ task.taskName }}
        </div>
        <PvChart
          type="bar"
          :data="setProgressChartData(getTaskStats(task))"
          :options="setProgressChartOptions(getTaskStats(task))"
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
        :data="setProgressChartData(getTotalStats())"
        :options="setProgressChartOptions(getTotalStats())"
        class="h-3rem chart-item"
      />
    </div>
    <ProgressLegend />
  </div>
</template>

<script setup>
import PvChart from 'primevue/chart';
import { computed } from 'vue';
import { setProgressChartData, setProgressChartOptions } from '@/helpers/plotting';
import ProgressLegend from '../ProgressLegend';

const props = defineProps({
  adminStats: {
    type: Object,
    required: true,
  },
  tasksDictionary: {
    type: Object,
    required: true,
  },
});

const totalAssignments = computed(() => {
  return (
    (props.adminStats?.studentsAssigned || 0) +
    (props.adminStats?.studentsStarted || 0) +
    (props.adminStats?.studentsCompleted || 0)
  );
});

/**
 * Per-task chart stats from a `byTask` overview entry.
 * The convenience totals (`assigned`/`started`/`completed`) are per-task,
 * mutually-exclusive student counts.
 */
const getTaskStats = (task) => {
  return {
    assigned: task?.assigned || 0,
    started: task?.started || 0,
    completed: task?.completed || 0,
  };
};

/**
 * Total stats are the per-student, assignment-level buckets across required tasks
 * (`studentsAssigned` + `studentsStarted` + `studentsCompleted` =
 * `studentsWithRequiredTasks`).
 */
const getTotalStats = () => {
  return {
    assigned: props.adminStats?.studentsAssigned || 0,
    started: props.adminStats?.studentsStarted || 0,
    completed: props.adminStats?.studentsCompleted || 0,
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
