<template>
  <div class="px-2 pt-2 rounded border border-gray-100 border-solid">
    <canvas v-if="showCanvas" ref="canvasRef" class="w-full h-full"></canvas>
    <img v-else :src="imgSrc" class="w-full h-auto" alt="Longitudinal chart" />
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { useLongitudinalSeries } from './useLongitudinalSeries';

const props = defineProps({
  longitudinalData: { type: Array, required: true },
  taskId: { type: String, required: true },
  studentGrade: { type: String, required: true },
});

const { series, seriesLabel } = useLongitudinalSeries(props);

const canvasRef = ref(null);
let chartInstance = null;
const showCanvas = ref(true);
const imgSrc = ref('');

const chartData = computed(() => ({
  datasets: [
    {
      label: seriesLabel.value,
      data: series.value.map((p) => ({ x: p.x, y: p.y })),
      borderColor: 'rgba(0,0,0,0.85)',
      backgroundColor: 'rgba(0,0,0,0.85)',
      pointBackgroundColor: series.value.map((p) => p.color),
      pointBorderColor: series.value.map((p) => p.color),
      borderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 5,
      tension: 0.4,
      spanGaps: true,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: 3,
  animation: false,
  events: [],
  plugins: { legend: false, tooltip: false },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: '#000' },
      grid: { color: 'rgba(0,0,0,0.15)' },
    },
    x: {
      type: 'timeseries',
      time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
      ticks: { color: '#000', maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
      grid: { display: false },
    },
  },
}));

async function renderThenSnapshot() {
  // Render the chart
  const ctx = canvasRef.value?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: chartData.value,
    options: chartOptions.value,
  });

  // Ensure it has painted at least once before snapshotting
  await nextTick();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Snapshot to data URL and swap to <img>
  const url = chartInstance.toBase64Image('image/png', 1); // full quality
  imgSrc.value = url;
  showCanvas.value = false;

  // Cleanup
  chartInstance.destroy();
  chartInstance = null;
}

onMounted(renderThenSnapshot);
onBeforeUnmount(() => {
  chartInstance?.destroy();
  chartInstance = null;
});
</script>
