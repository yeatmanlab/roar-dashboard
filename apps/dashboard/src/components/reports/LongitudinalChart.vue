<template>
  <div class="longitudinal-chart">
    <PvChart type="line" :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PvChart from 'primevue/chart';
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
});

const formatDate = (date) => {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Helper function to get consistent colors for score types
const getColorForType = (type) => {
  const colorMap = {
    rawScore: '#2196F3', // Blue
    percentile: '#4CAF50', // Green
    standardScore: '#FF9800', // Orange
    default: '#9C27B0', // Purple
  };
  return colorMap[type] || colorMap.default;
};

// Prepare chart data
const chartData = computed(() => {
  if (!props.longitudinalData?.length) {
    return { labels: [], datasets: [] };
  }

  const sortedData = [...props.longitudinalData].sort((a, b) => new Date(a.date) - new Date(b.date));

  const labels = sortedData.map((entry) => formatDate(entry.date));

  // Create datasets for each score type
  const datasets = [];

  // Only show raw scores
  const scoreTypes = ['rawScore'];

  // Create a dataset for each score type
  scoreTypes.forEach((scoreType) => {
    const scores = sortedData.map((entry) => {
      const score = entry.scores?.[scoreType];
      return score || null;
    });

    // Only add the dataset if we have at least one valid score
    if (scores.some((score) => score !== null)) {
      datasets.push({
        label: 'Raw Score',
        data: scores,
        fill: false,
        tension: 0.4,
        borderColor: getColorForType(scoreType),
        pointRadius: 4,
        pointHoverRadius: 6,
      });
    }
  });

  return { labels, datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
      labels: {
        usePointStyle: true,
        padding: 15,
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          return `Raw Score: ${context.parsed.y}`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.1)',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false,
  },
}));
</script>

<style scoped>
.longitudinal-chart {
  height: 300px;
  margin: 1rem 0;
  padding: 1rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
