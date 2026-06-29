<template>
  <div class="flex flex-wrap gap-3 p-5 bg-gray-100 rounded flex-column align-items-around">
    <div class="chart-grid">
      <div class="chart-section-header font-bold">Foundational Literacy Skills</div>

      <div v-for="taskId of taskIds" :key="taskId" class="chart-row">
        <div class="chart-label text-gray-600">
          <span class="whitespace-nowrap text-lg font-bold">{{
            tasksDictionary?.[taskId]?.technicalName ?? taskId
          }}</span>
          <span v-if="tasksDictionary?.[taskId]?.publicName" class="text-sm font-light uppercase">
            ({{ tasksDictionary?.[taskId]?.publicName }})</span
          >
        </div>
        <PvChart
          type="bar"
          :data="setDistributionChartData(supportLevelCountsByTaskId[taskId])"
          :options="setDistributionChartOptions(supportLevelCountsByTaskId[taskId])"
          class="h-2rem chart-item"
        />
        <span
          v-if="descriptionsByTaskId[taskId]"
          v-tooltip.top="`${descriptionsByTaskId[taskId].header}${descriptionsByTaskId[taskId].description}`"
          class="pi pi-info-circle info-icon h-full pt-1"
        />
        <span v-else class="info-icon-placeholder" />
        <div v-if="descriptionsByTaskId[taskId]" class="chart-description text-sm text-gray-500">
          {{ descriptionsByTaskId[taskId].header }}{{ descriptionsByTaskId[taskId].description }}
        </div>
      </div>
    </div>

    <div class="flex mx-5 flex-column align-items-center">
      <div class="flex flex-wrap gap-3 px-2 py-1 rounded justify-content-around align-items-center">
        <div class="flex flex-row items-center gap-2 text-sm font-light align-items-center">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.BELOW}`" />
          <div>Needs Extra Support</div>
        </div>
        <div class="flex flex-row items-center gap-2 text-sm font-light align-items-center">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.SOME}`" />
          <div>Developing Skill</div>
        </div>
        <div class="flex flex-row items-center gap-2 text-sm font-light align-items-center">
          <div class="legend-circle" :style="`background-color: ${SCORE_SUPPORT_LEVEL_COLORS.ABOVE}`" />
          <div>Achieved Skill</div>
        </div>
      </div>
      <div class="mt-1 text-xs font-light text-gray-500 uppercase">Legend</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PvChart from 'primevue/chart';
import { setDistributionChartData, setDistributionChartOptions } from '@/helpers/plotting';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';
import { descriptionsByTaskId } from '@/helpers/reports';

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

const supportLevelCountsByTaskId = computed(() => {
  const result = {};
  for (const taskId of props.taskIds) {
    const runs = props.runsByTaskId?.[taskId];
    if (!runs) {
      result[taskId] = { below: 0, some: 0, above: 0 };
      continue;
    }

    if (props.orgType === 'district') {
      result[taskId] = {
        below: runs.below?.total ?? 0,
        some: runs.some?.total ?? 0,
        above: runs.above?.total ?? 0,
      };
    } else {
      const counts = { below: 0, some: 0, above: 0 };
      for (const run of runs) {
        const supportLevel = run.scores?.support_level;
        if (supportLevel === 'Needs Extra Support') counts.below++;
        else if (supportLevel === 'Developing Skill') counts.some++;
        else if (supportLevel === 'Achieved Skill') counts.above++;
      }
      result[taskId] = counts;
    }
  }
  return result;
});
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  row-gap: 0.5rem;
  column-gap: 0.75rem;
  align-items: center;
}

.chart-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
}

.chart-section-header {
  grid-column: 1 / -1;
  text-align: center;
  text-transform: uppercase;
  margin-bottom: 2rem;
}

.chart-label {
  /* Adjust for whitespace in chart */
  margin-top: -0.25rem;
  max-width: 400px;
}

.chart-item {
  min-width: 0;
}

.chart-description {
  display: none;
}

.legend-circle {
  display: inline-block;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
}

.info-icon {
  font-size: 1rem;
  color: #592cfe;
  cursor: pointer;
}

@media (max-width: 768px) {
  .chart-grid {
    grid-template-columns: 1fr;
    row-gap: 1rem;
  }

  .chart-row {
    grid-template-columns: 1fr;
    row-gap: 0.25rem;
  }

  .info-icon,
  .info-icon-placeholder {
    display: none;
  }

  .chart-description {
    display: block;
  }
}
</style>
