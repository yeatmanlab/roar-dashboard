<template>
  <div class="longitudinal-chart px-2 pt-2 rounded border border-gray-100 border-solid" style="height: 10rem">
    <canvas ref="canvasRef" class="w-full h-full"></canvas>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { getSupportLevel } from '@/helpers/reports';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const canvasRef = ref(null);
let chartInstance = null;

const props = defineProps({
  longitudinalData: {
    type: Array,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
  grade: {
    type: Number,
    required: true,
  },
  currentAssignmentId: {
    type: String,
    required: true,
  },
});

const SCORE_TYPES = {
  rawScore: {
    key: 'rawScore',
    label: 'Raw Score',
    priority: 1,
  },
  percentile: {
    key: 'percentile',
    label: 'Percentile',
    priority: 2,
  },
  standardScore: {
    key: 'standardScore',
    label: 'Standard Score',
    priority: 3,
  },
};

// Utilities
const getLabelByScoreType = (type) => SCORE_TYPES[type]?.label ?? 'Score';

// List in priority order once
const preferredTypes = Object.values(SCORE_TYPES)
  .sort((a, b) => a.priority - b.priority)
  .map((t) => t.key);

// Prepare sorted data
const sortedData = computed(() => {
  if (!props.longitudinalData?.length) return [];
  return [...props.longitudinalData].sort((a, b) => new Date(a.date) - new Date(b.date));
});

// Prepare chart data
const chartData = computed(() => {
  const type = preferredTypes.find((t) => sortedData.value.some((e) => e.scores?.[t] != null));
  if (!type) return { datasets: [] };

  const points = sortedData.value
    .filter((e) => e.scores?.[type] != null && !Number.isNaN(+e.scores[type]))
    .map((e) => {
      const x = new Date(e.date);
      const y = +e.scores[type];
      const s = getSupportLevel(props.grade, e.scores?.percentile, e.scores?.rawScore, props.taskId);
      return {
        x,
        y,
        assignmentId: e.assignmentId || e.administrationId,
        percentile: e.scores?.percentile ?? null,
        standardScore: e.scores?.standardScore ?? null,
        color: s?.tag_color,
      };
    });

  return {
    datasets: [
      {
        label: getLabelByScoreType(type),
        data: points,
        tension: 0.4,
        borderColor: '#CCCCCC',
        pointRadius: points.map((p) => (p.assignmentId && p.assignmentId === props.currentAssignmentId ? 8 : 4)),
        pointHoverRadius: points.map((p) => (p.assignmentId && p.assignmentId === props.currentAssignmentId ? 10 : 6)),
        pointBackgroundColor: points.map((p) => p.color),
        pointBorderColor: points.map((p) =>
          p.assignmentId && p.assignmentId === props.currentAssignmentId ? '#000000' : p.color,
        ),
        pointBorderWidth: points.map((p) => (p.assignmentId && p.assignmentId === props.currentAssignmentId ? 2 : 1)),
        pointStyle: points.map((p) =>
          p.assignmentId && p.assignmentId === props.currentAssignmentId ? 'rectRot' : 'circle',
        ),
        spanGaps: true,
      },
    ],
  };
});

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
          const timestamp = items[0].parsed.x;
          return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(
            timestamp,
          );
        },
        label: (ctx) => {
          const point = ctx.dataset.data[ctx.dataIndex];
          const lines = [`${ctx.dataset.label}: ${point.y}`];
          if (point.percentile != null) lines.push(`Percentile: ${point.percentile}`);
          if (point.standardScore != null) lines.push(`Standard Score: ${point.standardScore}`);
          return lines;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.1)' },
    },
    x: {
      type: 'timeseries', // or revert to "time" if we need to display an actual time axis
      time: {
        unit: 'month',
        displayFormats: { month: 'MMM yyyy' },
      },
      ticks: {
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 8,
      },
      grid: { display: false },
    },
  },
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
}));

const createChart = () => {
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: chartData.value,
    options: chartOptions.value,
  });
};

onMounted(() => {
  createChart();
});

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>
