<template>
  <div class="longitudinal-chart">
    <PvChart
      type="line"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PvChart from 'primevue/chart';
import _startCase from 'lodash/startCase';

const props = defineProps({
  longitudinalData: {
    type: Array,
    required: true
  }
});

const formatDate = (date) => {
  return new Date(date).toLocaleDateString(undefined, { 
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatScoreType = (type) => {
  return _startCase(type.replace(/([A-Z])/g, ' $1').toLowerCase());
};

// Helper function to get consistent colors for score types
const getColorForType = (type) => {
  const colorMap = {
    rawScore: '#2196F3',       // Blue
    percentile: '#4CAF50',     // Green
    standardScore: '#FF9800',  // Orange
    default: '#9C27B0'         // Purple
  };
  return colorMap[type] || colorMap.default;
};

// Prepare chart data
const chartData = computed(() => {
  if (!props.longitudinalData?.length) return { labels: [], datasets: [] };

  const sortedData = [...props.longitudinalData].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sortedData.map(entry => formatDate(entry.date));
  
  // Create datasets for each score type
  const datasets = [];
  const scoreTypes = new Set();
  
  // First, collect all score types
  sortedData.forEach(entry => {
    if (entry.scores?.composite) {
      Object.entries(entry.scores.composite).forEach(([type, value]) => {
        if (value?.value !== undefined) {
          scoreTypes.add(type);
        }
      });
    }
  });

  // Then create a dataset for each type
  scoreTypes.forEach(type => {
    datasets.push({
      label: formatScoreType(type),
      data: sortedData.map(entry => entry.scores?.composite[type]?.value || null),
      fill: false,
      tension: 0.4,
      borderColor: getColorForType(type)
    });
  });

  return { labels, datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        usePointStyle: true,
        padding: 15
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          const value = context.parsed.y;
          return `${label}: ${Math.round(value)}`;
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(0,0,0,0.1)'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}));
</script>

<style scoped>
.longitudinal-chart {
  height: 300px;
  margin: 1rem 0;
  padding: 1rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
</style>
