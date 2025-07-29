<template>
  <div ref="chartContainer" class="longitudinal-wrapper">
    <div :id="chartId" class="chart-area"></div>
    <div v-if="minGradeByRuns < 6" class="view-by-wrapper my-2">
      <div class="flex uppercase text-xs font-light">view scores by</div>
      <PvSelectButton
        v-model="scoreMode"
        :allow-empty="false"
        class="flex flex-row my-2 select-button"
        :options="scoreModes"
        option-label="name"
        @change="handleModeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed, nextTick } from 'vue';
import embed from 'vega-embed';
import PvSelectButton from 'primevue/selectbutton';
import { combineScoresForLongitudinal } from '@/helpers/reports';

const props = defineProps({
  taskId: {
    type: String,
    required: true,
  },
  taskData: {
    type: Array,
    required: true,
  },
  grade: {
    type: Number,
    required: true,
  },
  minGradeByRuns: {
    type: Number,
    required: true,
  },
});

const scoreMode = ref({ name: 'Raw Score', key: 'rawScore' });
const scoreModes = [
  { name: 'Raw Score', key: 'rawScore' },
  { name: 'Percentile', key: 'percentileScore' },
  { name: 'Standard Score', key: 'standardScore' },
];

const longitudinalData = computed(() => {
  const data = combineScoresForLongitudinal(props.taskData, props.grade);
  return data[props.taskId] || [];
});

const getScoreRange = computed(() => {
  if (longitudinalData.value.length === 0) return { min: 0, max: 100 };

  switch (scoreMode.value.key) {
    case 'rawScore':
      return longitudinalData.value[0].range;
    case 'percentileScore':
      return { min: 0, max: 100 };
    case 'standardScore':
      return { min: 0, max: 180 };
    default:
      return { min: 0, max: 100 };
  }
});

const getSpec = () => ({
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  width: 'container',
  height: 300,
  data: {
    values: longitudinalData.value,
  },
  mark: {
    type: 'line',
    point: true,
    tooltip: true,
  },
  encoding: {
    x: {
      field: 'date',
      type: 'temporal',
      title: 'Assessment Date',
      axis: {
        format: '%b %d, %Y',
      },
    },
    y: {
      field: scoreMode.value.key,
      type: 'quantitative',
      title: scoreMode.value.name,
      scale: {
        domain: [getScoreRange.value.min, getScoreRange.value.max],
      },
    },
    color: {
      field: 'supportColor',
      type: 'nominal',
      scale: null,
    },
    tooltip: [
      { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
      { field: scoreMode.value.key, type: 'quantitative', title: scoreMode.value.name },
      { field: 'supportLevel', type: 'nominal', title: 'Support Level' },
    ],
  },
});

const chartId = computed(() => `roar-longitudinal-chart-${props.taskId}-${Date.now()}`);
let chartView = null;

const draw = async () => {
  try {
    // Wait for the next tick to ensure DOM is ready
    await nextTick();

    // Clean up previous chart if it exists
    if (chartView) {
      try {
        await chartView.finalize();
      } catch (e) {
        console.warn('Error cleaning up previous chart:', e);
      }
    }

    // Create new chart
    chartView = await embed(`#${chartId.value}`, getSpec(), {
      actions: false,
      renderer: 'svg',
    });
  } catch (error) {
    console.error('Error drawing longitudinal chart:', error);
  }
};

const handleModeChange = () => {
  draw();
};

watch(
  longitudinalData,
  () => {
    draw();
  },
  { deep: true },
);

onMounted(async () => {
  await draw();
});

onBeforeUnmount(() => {
  if (chartView) {
    try {
      chartView.finalize();
    } catch (e) {
      console.warn('Error cleaning up chart on unmount:', e);
    }
  }
});
</script>

<style scoped>
.longitudinal-wrapper {
  width: 100%;
  padding: 1rem;
}

.chart-area {
  width: 100%;
  min-height: 300px;
}

.view-by-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

:deep(.select-button) {
  font-size: 0.75rem;
}

:deep(.p-button) {
  padding: 0.5rem 1rem;
}
</style>
