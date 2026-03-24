<template>
  <div class="p-2 rounded border border-gray-100 border-solid" data-cy="longitudinal-chart">
    <div class="h-64">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>
    <template v-if="showSupportLevels">
      <div class="flex gap-3 justify-end mt-2 text-xs">
        <div class="ml-2 flex gap-2 align-items-center">
          <div
            class="rounded-full flex-shrink-0"
            style="width: 1rem; height: 1rem"
            :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.ABOVE }"
          ></div>
          <span>{{ $t('scoreReports.achievedChartLabel') }}</span>
        </div>
        <div class="flex gap-2 align-items-center">
          <div
            class="rounded-full flex-shrink-0"
            style="width: 1rem; height: 1rem"
            :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.SOME }"
          ></div>
          <span>{{ $t('scoreReports.developingChartLabel') }}</span>
        </div>
        <div class="flex gap-2 align-items-center">
          <div
            class="rounded-full flex-shrink-0"
            style="width: 1rem; height: 1rem"
            :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.BELOW }"
          ></div>
          <span>{{ $t('scoreReports.extraSupportChartLabel') }}</span>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="flex justify-content-center align-items-center gap-2 mt-4 text-xs">
        <div
          class="rounded-full flex-shrink-0"
          style="width: 1rem; height: 1rem"
          :style="{ backgroundColor: SCORE_SUPPORT_LEVEL_COLORS.ASSESSED }"
        ></div>
        <span>{{ $t('scoreReports.assessedChartLabel') }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();

const props = defineProps({
  longitudinalData: { type: Array, required: true },
  taskId: { type: String, required: true },
  studentGrade: { type: String, required: true },
  currentAssignmentId: { type: String, required: true },
  scoreLabel: { type: String, required: true },
});

const { series, seriesLabel, seriesStroke } = useLongitudinalSeries(props);

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

const metricKey = computed(() => {
  // Decide what the Y-values represent for this task
  if (seriesLabel.value.includes('percent')) return 'percentCorrect';
  if (seriesLabel.value.includes('total')) return 'rawScore'; // “total correct” is still a raw score count
  if (seriesLabel.value.includes('grade')) return 'gradeEstimate'; // only if you have this translation
  return 'rawScore';
});

const chartData = computed(() => ({
  datasets: [
    {
      label: t(`scoreReports.${metricKey.value}`),
      data: filteredSeries.value.map((p) => ({ x: p.x, y: p.y })),
      tension: 0.4,
      borderColor: seriesStroke.value,
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
          const lines = [];
          if (p.assignmentId === props.currentAssignmentId) lines.push('✦ Current Score Report ✦');

          // Always show all available scores in a consistent order
          if (p.rawScore != null) lines.push(`Raw Score: ${p.rawScore}`);
          if (p.percentile != null) lines.push(`Percentile: ${p.percentile}`);
          if (p.standardScore != null) lines.push(`Standard Score: ${p.standardScore}`);

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
        text: t(`scoreReports.${metricKey.value}`),
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
