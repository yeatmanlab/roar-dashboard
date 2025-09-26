<template>
  <div class="longitudinal-chart px-2 pt-2 rounded border border-gray-100 border-solid">
    <div style="height: 10rem">
      <canvas ref="canvasRef" class="w-full h-full"></canvas>
    </div>
    <div class="support-level-legend flex justify-end gap-3 mt-2 text-xs">
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-full" style="background-color: green"></div>
        <span>Achieved Skill</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-full" style="background-color: #edc037"></div>
        <span>Developing Skill</span>
      </div>
      <div class="flex items-center gap-1">
        <div class="w-3 h-3 rounded-full" style="background-color: #c93d82"></div>
        <span>Needs Extra Support</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { getSupportLevel } from '@/helpers/reports';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { SCORE_TYPES } from '@/constants/scores';

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

// Utilities
const getLabelByScoreType = (type) => SCORE_TYPES[type]?.label ?? 'Score';

// List in priority order once
const preferredTypes = Object.values(SCORE_TYPES)
  .sort((a, b) => Number(a.priority ?? 0) - Number(b.priority ?? 0))
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

  const scoreType = type;

  const points = sortedData.value
    .filter((e) => {
      const score = e.scores?.[scoreType];
      return score != null && !Number.isNaN(Number(score));
    })
    .map((e) => {
      const x = new Date(e.date);
      const y = Number(e.scores[scoreType]);
      const s = getSupportLevel(props.grade, e.scores?.percentile, e.scores?.rawScore, props.taskId);
      return {
        x,
        y,
        assignmentId: e.assignmentId || e.administrationId || '',
        percentile: e.scores?.percentile ?? null,
        standardScore: e.scores?.standardScore ?? null,
        color: s?.tag_color || '#CCCCCC',
      };
    });

  return {
    datasets: [
      {
        type: 'line',
        label: getLabelByScoreType(scoreType),
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
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const timestamp = items[0]?.parsed?.x;
          return timestamp
            ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(timestamp)
            : '';
        },
        label: (ctx) => {
          const point = ctx.dataset.data[ctx.dataIndex];
          if (!point) return [];
          const lines = [`${ctx.dataset.label}: ${point.y}`];
          if (point.percentile != null) lines.push(`Percentile: ${point.percentile}`);
          if (point.standardScore != null) lines.push(`Standard Score: ${point.standardScore}`);
          if (point.assignmentId === props.currentAssignmentId) lines.unshift('✦ Current Score Report ✦');
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
      type: 'time', // switch to 'timeseries' for evenly distributed points on the time axis
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
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();

  const config = {
    type: 'line',
    data: chartData.value,
    options: chartOptions.value,
  };
  chartInstance = new Chart(ctx, config);
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
