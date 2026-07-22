<template>
  <div class="flex gap-3 p-5 bg-gray-100 rounded flex-column align-items-around" style="width: 100%">
    <!-- Foundational Literacy Skills Section -->
    <div class="chart-grid">
      <div class="chart-section-header font-bold">Foundational Literacy Skills</div>

      <div v-for="taskId of foundationalTaskIds" :key="taskId" class="chart-row">
        <div class="chart-label text-gray-600">
          <span class="whitespace-nowrap text-lg font-bold">{{
            tasksDictionary?.[taskId]?.technicalName ?? taskId
          }}</span>
          <span v-if="tasksDictionary?.[taskId]?.publicName" class="text-sm font-light uppercase">
            ({{ tasksDictionary?.[taskId]?.publicName }})</span
          >
        </div>
        <PvChart
          v-if="!isChartEmpty(supportLevelCountsByTaskId[taskId])"
          type="bar"
          :data="chartDataByTaskId[taskId]"
          :options="chartOptionsByTaskId[taskId]"
          class="h-2rem chart-item"
        />
        <PvChart v-else type="bar" :data="grayChartData" :options="grayChartOptions" class="h-2rem chart-item" />
        <span
          v-if="descriptionsByTaskId[taskId]"
          v-tooltip.top="`${descriptionsByTaskId[taskId].header}${descriptionsByTaskId[taskId].description}`"
          class="pi pi-info-circle info-icon h-full pt-1"
          data-html2canvas-ignore="true"
        />
        <span v-else class="info-icon-placeholder" data-html2canvas-ignore="true" />
        <div v-if="descriptionsByTaskId[taskId]" class="chart-description text-sm text-gray-500">
          {{ descriptionsByTaskId[taskId].header }}{{ descriptionsByTaskId[taskId].description }}
        </div>
      </div>

      <div v-if="compositeFoundational" class="chart-row">
        <div class="chart-label text-gray-600">
          <span class="whitespace-nowrap text-lg font-bold">Foundational Skills Composite</span>
          <!-- <span class="text-sm font-light uppercase"> (Composite Score)</span> -->
        </div>
        <PvChart
          v-if="!isChartEmpty(compositeFoundational)"
          type="bar"
          :data="compositeFoundationalChartData"
          :options="compositeFoundationalChartOptions"
          class="h-2rem chart-item"
        />
        <PvChart v-else type="bar" :data="grayChartData" :options="grayChartOptions" class="h-2rem chart-item" />
        <span
          v-tooltip.top="
            'The Foundational Skills Composite reflects overall performance on foundational reading skills, including phonological awareness, letter knowledge, word reading, and sentence reading.'
          "
          class="pi pi-info-circle info-icon h-full pt-1"
          data-html2canvas-ignore="true"
        />
        <div class="chart-description text-sm text-gray-500">
          The Foundational Skills Composite reflects overall performance on foundational reading skills, including
          phonological awareness, letter knowledge, word reading, and sentence reading.
        </div>
      </div>
    </div>

    <hr v-if="spanishFoundationalTaskIds.length > 0" class="divider" />

    <!-- Spanish Foundational Literacy Skills Section -->
    <div v-if="spanishFoundationalTaskIds.length > 0" class="chart-grid">
      <div class="chart-section-header font-bold">Spanish Foundational Literacy Skills</div>

      <div v-for="taskId of spanishFoundationalTaskIds" :key="taskId" class="chart-row">
        <div class="chart-label text-gray-600">
          <span class="whitespace-nowrap text-lg font-bold">{{
            tasksDictionary?.[taskId]?.technicalName ?? taskId
          }}</span>
          <span v-if="tasksDictionary?.[taskId]?.publicName" class="text-sm font-light uppercase">
            ({{ tasksDictionary?.[taskId]?.publicName }})</span
          >
        </div>
        <PvChart
          v-if="!isChartEmpty(supportLevelCountsByTaskId[taskId])"
          type="bar"
          :data="chartDataByTaskId[taskId]"
          :options="chartOptionsByTaskId[taskId]"
          class="h-2rem chart-item"
        />
        <PvChart v-else type="bar" :data="grayChartData" :options="grayChartOptions" class="h-2rem chart-item" />
        <span
          v-if="descriptionsByTaskId[taskId]"
          v-tooltip.top="`${descriptionsByTaskId[taskId].header}${descriptionsByTaskId[taskId].description}`"
          class="pi pi-info-circle info-icon h-full pt-1"
          data-html2canvas-ignore="true"
        />
        <span v-else class="info-icon-placeholder" data-html2canvas-ignore="true" />
        <div v-if="descriptionsByTaskId[taskId]" class="chart-description text-sm text-gray-500">
          {{ descriptionsByTaskId[taskId].header }}{{ descriptionsByTaskId[taskId].description }}
        </div>
      </div>
    </div>

    <hr v-if="comprehensionTaskIds.length > 0" class="divider" />

    <!-- Comprehension Skills Section -->
    <div v-if="comprehensionTaskIds.length > 0" class="chart-grid">
      <div class="chart-section-header font-bold">Comprehension Skills</div>

      <div v-for="taskId of comprehensionTaskIds" :key="taskId" class="chart-row">
        <div class="chart-label text-gray-600">
          <span class="whitespace-nowrap text-lg font-bold">{{
            tasksDictionary?.[taskId]?.technicalName ?? taskId
          }}</span>
          <span v-if="tasksDictionary?.[taskId]?.publicName" class="text-sm font-light uppercase">
            ({{ tasksDictionary?.[taskId]?.publicName }})</span
          >
        </div>
        <PvChart
          v-if="!isChartEmpty(supportLevelCountsByTaskId[taskId])"
          type="bar"
          :data="chartDataByTaskId[taskId]"
          :options="chartOptionsByTaskId[taskId]"
          class="h-2rem chart-item"
        />
        <PvChart v-else type="bar" :data="grayChartData" :options="grayChartOptions" class="h-2rem chart-item" />
        <span
          v-if="descriptionsByTaskId[taskId]"
          v-tooltip.top="`${descriptionsByTaskId[taskId].header}${descriptionsByTaskId[taskId].description}`"
          class="pi pi-info-circle info-icon h-full pt-1"
          data-html2canvas-ignore="true"
        />
        <span v-else class="info-icon-placeholder" data-html2canvas-ignore="true" />
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
import { SCORE_SUPPORT_LEVEL_COLORS , SCORE_SUPPORT_SKILL_LEVELS } from '@/constants/scores';
import { descriptionsByTaskId } from '@/helpers/reports';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes';

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

const foundationalTaskIds = computed(() => {
  const foundational = ['swr', 'sre', 'pa', 'letter', 'letter-en-ca'];
  return props.taskIds.filter((id) => foundational.includes(id));
});

const spanishFoundationalTaskIds = computed(() => {
  const spanishFoundational = ['swr-es', 'sre-es'];
  return props.taskIds.filter((id) => spanishFoundational.includes(id));
});

const comprehensionTaskIds = computed(() => {
  const comprehension = ['morphology', 'cva', 'trog', 'roar-inference', 'vocab'];
  return props.taskIds.filter((id) => comprehension.includes(id));
});

const compositeFoundational = computed(() => {
  const composite = props.runsByTaskId?.['compositeFoundational'];
  if (!composite) return null;

  if (props.orgType === SINGULAR_ORG_TYPES.DISTRICTS) {
    return {
      below: composite.below?.total ?? 0,
      some: composite.some?.total ?? 0,
      above: composite.above?.total ?? 0,
    };
  }

  const counts = { below: 0, some: 0, above: 0 };
  for (const run of composite) {
    const supportLevel = run.scores?.support_level;
    if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT) counts.below++;
    else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL) counts.some++;
    else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL) counts.above++;
  }
  return counts;
});

const supportLevelCountsByTaskId = computed(() => {
  const result = {};
  for (const taskId of props.taskIds) {
    const runs = props.runsByTaskId?.[taskId];
    if (!runs) {
      result[taskId] = { below: 0, some: 0, above: 0 };
      continue;
    }

    if (props.orgType === SINGULAR_ORG_TYPES.DISTRICTS) {
      result[taskId] = {
        below: runs.below?.total ?? 0,
        some: runs.some?.total ?? 0,
        above: runs.above?.total ?? 0,
      };
    } else {
      const counts = { below: 0, some: 0, above: 0 };
      for (const run of runs) {
        const supportLevel = run.scores?.support_level;
        if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT) counts.below++;
        else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL) counts.some++;
        else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL) counts.above++;
      }
      result[taskId] = counts;
    }
  }
  return result;
});

const isChartEmpty = (chartData) => {
  return !chartData || (chartData.below === 0 && chartData.some === 0 && chartData.above === 0);
};

// Memoized so PvChart receives a stable reference across re-renders, avoiding needless
// Chart.js destroy/recreate cycles (its `options` watcher fires on reference change alone).
const chartDataByTaskId = computed(() => {
  const result = {};
  for (const taskId of props.taskIds) {
    result[taskId] = setDistributionChartData(supportLevelCountsByTaskId.value[taskId]);
  }
  return result;
});

const chartOptionsByTaskId = computed(() => {
  const result = {};
  for (const taskId of props.taskIds) {
    result[taskId] = setDistributionChartOptions(supportLevelCountsByTaskId.value[taskId]);
  }
  return result;
});

const compositeFoundationalChartData = computed(() =>
  compositeFoundational.value ? setDistributionChartData(compositeFoundational.value) : null,
);

const compositeFoundationalChartOptions = computed(() =>
  compositeFoundational.value ? setDistributionChartOptions(compositeFoundational.value) : null,
);

const grayChartData = computed(() => ({
  labels: [''],
  datasets: [
    {
      label: 'No Data',
      data: [1],
      backgroundColor: '#dadee6',
      borderRadius: 6,
      borderSkipped: false,
    },
  ],
}));

const grayChartOptions = computed(() => {
  const baseOptions = setDistributionChartOptions({ below: 1, some: 0, above: 0 });
  return {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          label: () => 'No data yet',
        },
      },
    },
  };
});
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: 27rem 1fr auto;
  row-gap: 0.5rem;
  column-gap: 0.75rem;
  align-items: center;
  min-width: 100%;
  width: 100%;
}

.chart-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  height: 2rem;
}

.chart-section-header {
  grid-column: 1 / -1;
  text-align: center;
  text-transform: uppercase;
  margin-bottom: 1rem;
}

.chart-label {
  /* Adjust for whitespace in chart */
  margin-top: -0.25rem;
  max-width: 400px;
}

.chart-item {
  min-width: 0;
  height: 2rem !important;
  max-height: 2rem !important;
  border-radius: 0.25rem;
}

.chart-item-large {
  height: 3rem !important;
}

.divider {
  grid-column: 1 / -1;
  margin: 0.5rem 0;
  border: none;
  border-top: 1px solid #d1d5db;
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

<style>
.pdf-export-mode .chart-description {
  display: block !important;
  grid-column: 1 / -1;
}

.pdf-export-mode .info-icon,
.pdf-export-mode .info-icon-placeholder {
  display: none !important;
}
</style>
