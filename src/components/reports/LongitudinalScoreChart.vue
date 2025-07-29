<template>
  <div ref="chartContainer" class="longitudinal-wrapper">
    <div v-if="hasValidData && longitudinalData.length > 0">
      <div :id="chartId" class="chart-area"></div>
    </div>
    <div v-else class="no-data-message">
      <p>No assessment data available to display.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import embed from 'vega-embed';
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

// Remove score mode selection since we're only showing raw scores

const hasValidData = computed(() => {
  return props.taskData && Array.isArray(props.taskData) && props.taskData.length > 0;
});

const longitudinalData = computed(() => {
  if (!hasValidData.value) return [];
  const data = combineScoresForLongitudinal(props.taskData, props.grade);
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

    // Don't try to render if we have no data
    if (!hasValidData.value || longitudinalData.value.length === 0) {
      console.warn('No valid data to display in chart');
      return;
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
