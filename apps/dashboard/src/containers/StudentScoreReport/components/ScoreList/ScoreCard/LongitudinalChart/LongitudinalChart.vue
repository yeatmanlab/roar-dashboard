<template>
  <div class="p-2 rounded border border-gray-100 border-solid" data-cy="longitudinal-chart">
    <div class="h-64">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>
    <div v-if="showSupportLevels" class="flex gap-3 justify-end mt-2 text-xs">
      <div class="flex gap-1 items-center">
        <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.ABOVE }"></div>
        <span>Achieved Skill</span>
      </div>
      <div class="flex gap-1 items-center">
        <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.SOME }"></div>
        <span>Developing Skill</span>
      </div>
      <div class="flex gap-1 items-center">
        <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.BELOW }"></div>
        <span>Needs Extra Support</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { useLongitudinalSeries } from './useLongitudinalSeries';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';
import {
  tasksToDisplayPercentCorrect,
  tasksToDisplayTotalCorrect,
  tasksToDisplayGradeEstimate,
} from '@/helpers/reports';

const canvasRef = ref(null);
let chartInstance = null;

const props = defineProps({
  longitudinalData: { type: Array, required: true },
  taskId: { type: String, required: true },
  studentGrade: { type: String, required: true },
  currentAssignmentId: { type: String, required: true },
  scoreLabel: { type: String, required: true },
});

const { series, seriesStroke } = useLongitudinalSeries(props);

// Filter series to only show points up to current assignment
const filteredSeries = computed(() => {
  const currentAssignment = series.value.find((p) => p.assignmentId === props.currentAssignmentId);
  if (!currentAssignment) return [];
  const currentDate = currentAssignment.x;
  return series.value.filter((p) => p.x <= currentDate);
});

const showSupportLevels = computed(() => {
  // Don't show support levels if the task is in any of these lists
  const isDisplayTask = [
    ...tasksToDisplayPercentCorrect,
    ...tasksToDisplayTotalCorrect,
    ...tasksToDisplayGradeEstimate,
  ].includes(props.taskId);

  // Check if any data point has a support level color
  const hasSupportLevels = series.value.some((point) =>
    Object.values(SCORE_SUPPORT_LEVEL_COLORS).includes(point.color),
  );

  return !isDisplayTask && hasSupportLevels;
});

const chartData = computed(() => ({
  datasets: [
    {
      label: props.scoreLabel,
      data: filteredSeries.value.map((p) => ({ x: p.x, y: p.y })),
      tension: 0.4,
      borderColor: seriesStroke,
      pointRadius: filteredSeries.value.map((p) =>
        p.assignmentId && p.assignmentId === props.currentAssignmentId ? 8 : 4,
      ),
      pointHoverRadius: filteredSeries.value.map((p) =>
        p.assignmentId && p.assignmentId === props.currentAssignmentId ? 10 : 6,
      ),
      pointBackgroundColor: filteredSeries.value.map((p) => p.color),
      pointBorderColor: filteredSeries.value.map((p) =>
        p.assignmentId && p.assignmentId === props.currentAssignmentId ? '#000000' : p.color,
      ),
      pointBorderWidth: filteredSeries.value.map((p) =>
        p.assignmentId && p.assignmentId === props.currentAssignmentId ? 2 : 1,
      ),
      pointStyle: filteredSeries.value.map((p) =>
        p.assignmentId && p.assignmentId === props.currentAssignmentId ? 'rectRot' : 'circle',
      ),
      spanGaps: true,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  normalized: true,
  maintainAspectRatio: false,
  plugins: {
    legend: false,
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const ts = items[0].parsed.x;
          return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(ts);
        },
        label: (ctx) => {
          const p = series.value[ctx.dataIndex];
          const lines = [`${props.scoreLabel}: ${p.y}`];
          if (p.percentile != null) lines.push(`Percentile: ${p.percentile}`);
          if (p.standardScore != null) lines.push(`Standard Score: ${p.standardScore}`);
          if (p.assignmentId === props.currentAssignmentId) lines.unshift('✦ Current Score Report ✦');
          return lines;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.1)' },
      title: {
        display: true,
        text: props.scoreLabel,
        font: {
          size: 12,
        },
      },
    },
    x: {
      type: 'time',
      time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
      ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
      grid: { display: false },
    },
  },
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
}));

function createChart() {
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, { type: 'line', data: chartData.value, options: chartOptions.value });
}

onMounted(createChart);
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});

watch([chartData, chartOptions], () => {
  if (!chartInstance) return;
  chartInstance.data = chartData.value;
  chartInstance.options = chartOptions.value;
  chartInstance.update();
});
</script>
