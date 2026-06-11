<template>
  <div class="flex flex-wrap gap-3 p-5 bg-gray-100 rounded flex-column align-items-around">
    <div class="chart-grid">
      <div class="chart-section-header">Score Distribution by Assessment</div>

      <template v-for="taskId of taskIds" :key="taskId">
        <div class="chart-label text-lg font-bold text-gray-600">
          <span class="whitespace-nowrap">{{ tasksDictionary?.[taskId]?.publicName ?? taskId }}</span>
        </div>
        <PvChart
          type="bar"
          :data="setDistributionChartData(getSupportLevelCounts(taskId))"
          :options="setDistributionChartOptions(getSupportLevelCounts(taskId))"
          class="h-2rem chart-item"
        />
      </template>
    </div>

    <div class="flex mx-5 flex-column align-items-center">
      <div class="flex flex-wrap gap-3 px-2 py-1 rounded justify-content-around align-items-center">
        <div class="flex flex-row items-center gap-2 text-sm font-light">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.BELOW}`" />
          <div>Needs Extra Support</div>
        </div>
        <div class="flex flex-row items-center gap-2 text-sm font-light">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.SOME}`" />
          <div>Developing Skill</div>
        </div>
        <div class="flex flex-row items-center gap-2 text-sm font-light">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.ABOVE}`" />
          <div>Achieved Skill</div>
        </div>
      </div>
      <div class="mt-1 text-xs font-light text-gray-500 uppercase">Legend</div>
    </div>
  </div>
</template>

<script setup>
import PvChart from 'primevue/chart';
import { setDistributionChartData, setDistributionChartOptions } from '@/helpers/plotting';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

const props = defineProps({
  taskIds: {
    type: Array,
    required: true,
  },
  runsByTaskId: {
    type: Object,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  tasksDictionary: {
    type: Object,
    required: false,
    default: () => ({}),
  },
});

const getSupportLevelCounts = (taskId) => {
  const runs = props.runsByTaskId?.[taskId];
  if (!runs) return { below: 0, some: 0, above: 0 };

  if (props.orgType === 'district') {
    return {
      below: runs.below?.total ?? 0,
      some: runs.some?.total ?? 0,
      above: runs.above?.total ?? 0,
    };
  }

  const counts = { below: 0, some: 0, above: 0 };
  for (const run of runs) {
    const supportLevel = run.scores?.support_level;
    if (supportLevel === 'Needs Extra Support') counts.below++;
    else if (supportLevel === 'Developing Skill') counts.some++;
    else if (supportLevel === 'Achieved Skill') counts.above++;
  }
  return counts;
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

.chart-item {
  min-width: 0;
}

.legend-circle {
  display: inline-block;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
}

@media (max-width: 1200px) {
  .chart-label {
    max-width: 300px;
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
