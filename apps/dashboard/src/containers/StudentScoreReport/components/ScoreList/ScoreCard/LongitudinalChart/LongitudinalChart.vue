<template>
  <div class="px-2 pt-2 h-64 rounded border border-gray-100 border-solid" style="height: 10rem">
    <canvas ref="canvasRef" class="w-full h-full"></canvas>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { useLongitudinalSeries } from './useLongitudinalSeries';

const canvasRef = ref(null);
let chartInstance = null;

const props = defineProps({
  longitudinalData: { type: Array, required: true },
  taskId: { type: String, required: true },
  studentGrade: { type: String, required: true },
});

const { series, seriesLabel, seriesStroke } = useLongitudinalSeries(props);

const chartData = computed(() => ({
  datasets: [
    {
      label: seriesLabel.value,
      data: series.value.map((p) => ({ x: p.x, y: p.y })),
      tension: 0.4,
      borderColor: seriesStroke.value,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: series.value.map((p) => p.color),
      pointBorderColor: series.value.map((p) => p.color),
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
          const lines = [`${seriesLabel.value}: ${p.y}`];
          if (p.percentile != null) lines.push(`Percentile: ${p.percentile}`);
          if (p.standardScore != null) lines.push(`Standard Score: ${p.standardScore}`);
          return lines;
        },
      },
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.1)' } },
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
