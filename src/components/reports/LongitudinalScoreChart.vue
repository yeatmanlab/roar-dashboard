<template>
  <div ref="chartContainer" class="longitudinal-wrapper">
    <div v-if="isLoading" class="loading-message">
      <p>Loading chart data...</p>
    </div>
    <div v-else-if="hasValidData && longitudinalData.length > 0">
      <div :id="chartId" class="chart-area"></div>
    </div>
    <div v-else class="no-data-message">
      <p>No assessment data available to display.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, computed, nextTick, ref } from 'vue';
import embed from 'vega-embed';
import { combineScoresForLongitudinal } from '@/helpers/reports';

const isLoading = ref(false);

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

// Remove score mode selection since we're only showing raw scores

const hasValidData = computed(() => {
  return props.taskData && Array.isArray(props.taskData) && props.taskData.length > 0 && props.grade !== undefined;
});

const longitudinalData = computed(() => {
  if (!hasValidData.value) {
    console.log('No valid data for chart');
    return [];
  }
  console.log('Task data for longitudinal:', props.taskData);
  console.log('Grade:', props.grade);
  const data = combineScoresForLongitudinal(props.taskData, props.grade);
  console.log('Combined scores:', data);
  console.log('Data for taskId', props.taskId, ':', data[props.taskId]);
  return data[props.taskId] || [];
});

const getScoreRange = computed(() => {
  if (!hasValidData.value || longitudinalData.value.length === 0) {
    return { min: 0, max: 100 };
  }

  try {
    return longitudinalData.value[0]?.range || { min: 0, max: 100 };
  } catch (error) {
    console.warn('Error getting score range:', error);
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
  layer: [
    // Line layer
    {
      mark: {
        type: 'line',
        color: '#E0E0E0',
        strokeWidth: 1,
      },
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
          title: 'Assessment Date',
          axis: {
            format: '%b %d, %Y',
            labelAngle: -45,
            grid: true,
          },
        },
        y: {
          field: 'rawScore',
          type: 'quantitative',
          title: 'Raw Score',
          scale: {
            domain: [getScoreRange.value.min, getScoreRange.value.max],
          },
          axis: {
            grid: true,
          },
        },
      },
    },
    // Points layer
    {
      mark: {
        type: 'circle',
        size: 100,
        filled: true,
        tooltip: true,
      },
      encoding: {
        x: {
          field: 'date',
          type: 'temporal',
        },
        y: {
          field: 'rawScore',
          type: 'quantitative',
        },
        color: {
          field: 'supportColor',
          type: 'nominal',
          scale: null,
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
          { field: 'rawScore', type: 'quantitative', title: 'Raw Score' },
          { field: 'supportLevel', type: 'nominal', title: 'Support Level' },
        ],
      },
    },
  ],
});

const chartId = computed(() => `roar-longitudinal-chart-${props.taskId}-${Date.now()}`);
let chartView = null;

const draw = async () => {
  console.log('Drawing chart with data:', longitudinalData.value);
  try {
    isLoading.value = true;

    // Wait for the next tick to ensure DOM is ready
    await nextTick();

    // Clear existing chart if it exists
    if (chartView) {
      try {
        await chartView.finalize();
      } catch (error) {
        console.warn('Error finalizing chart:', error);
      }
    }

    // Create new chart
    const view = await embed(`#${chartId.value}`, getSpec(), {
      actions: false,
      renderer: 'svg',
    });
    chartView = view;
  } catch (error) {
    console.error('Error drawing chart:', error);
  } finally {
    isLoading.value = false;
  }
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

.no-data-message {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  background: #f8f9fa;
  border-radius: 8px;
  color: #6c757d;
  font-size: 0.9rem;
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
