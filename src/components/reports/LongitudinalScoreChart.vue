<template>
  <div ref="chartContainer" class="longitudinal-wrapper">
    <div v-if="isLoading" class="loading-message">
      <p>Loading chart data...</p>
    </div>
    <div v-else-if="hasValidData">
      <div v-if="longitudinalData.length > 0">
        <div :id="chartId" class="chart-area"></div>
      </div>
      <div v-else class="no-data-message">
        <p>No assessment data available to display.</p>
      </div>
    </div>
    <div v-else class="no-data-message">
      <p>Invalid data configuration.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, computed, nextTick, ref } from 'vue';
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
  const isValid = props.taskData && Array.isArray(props.taskData) && props.grade !== undefined;
  console.log('Data validation:', {
    hasTaskData: !!props.taskData,
    isArray: Array.isArray(props.taskData),
    hasGrade: props.grade !== undefined,
  });
  return isValid;
});

const longitudinalData = computed(() => {
  console.log('Computing longitudinal data...');
  console.log('Props:', {
    taskData: props.taskData,
    grade: props.grade,
    taskId: props.taskId,
  });

  if (!hasValidData.value) {
    console.log('No valid data for chart');
    return [];
  }

  console.log('Task data for longitudinal:', JSON.stringify(props.taskData, null, 2));
  console.log('Grade:', props.grade);

  const data = combineScoresForLongitudinal(props.taskData || [], props.grade);
  console.log('Combined scores:', JSON.stringify(data, null, 2));

  const taskData = data[props.taskId] || [];
  console.log('Final data for chart:', JSON.stringify(taskData, null, 2));

  return taskData;
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

const getSpec = () => {
  console.log('Generating chart spec with:', {
    data: longitudinalData.value,
    range: getScoreRange.value,
  });

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height: 300,
    autosize: {
      type: 'fit',
      contains: 'padding',
    },
    data: {
      values: longitudinalData.value,
    },
    config: {
      axis: {
        labelFont: 'Inter',
        titleFont: 'Inter',
      },
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
              domain: [
                0,
                Math.max(getScoreRange.value.max, Math.max(...longitudinalData.value.map((d) => d.rawScore))),
              ],
              nice: true,
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
  };
};

// Component state
const isLoading = ref(false);
const chartContainer = ref(null);
let chartView = null;

// Computed properties
const chartId = computed(() => `roar-longitudinal-chart-${props.taskId.replace(/[^a-zA-Z0-9-]/g, '-')}`);

// Methods
const ensureChartContainer = () => {
  if (!chartContainer.value) {
    console.error('Chart container ref not initialized');
    return null;
  }

  let container = document.getElementById(chartId.value);
  if (!container) {
    console.log('Creating chart container with ID:', chartId.value);
    container = document.createElement('div');
    container.id = chartId.value;
    container.className = 'chart-area';
    chartContainer.value.appendChild(container);
  }
  return container;
};

const draw = async () => {
  console.log('Drawing chart with data:', longitudinalData.value);
  try {
    if (!longitudinalData.value || longitudinalData.value.length === 0) {
      console.log('No data to draw');
      return;
    }

    isLoading.value = true;
    await nextTick();

    // Ensure container exists
    const container = ensureChartContainer();
    if (!container) {
      console.error(`Failed to create chart container #${chartId.value}`);
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Generate spec
    const spec = getSpec();
    console.log('Chart spec:', JSON.stringify(spec, null, 2));

    // Clear existing chart if it exists
    if (chartView) {
      try {
        await chartView.finalize();
      } catch (error) {
        console.warn('Error finalizing chart:', error);
      }
    }

    // Clear container
    container.innerHTML = '';

    // Create new chart
    const view = await embed(`#${chartId.value}`, spec, {
      actions: false,
      renderer: 'svg',
      downloadFileName: `roar-longitudinal-${props.taskId}`,
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
