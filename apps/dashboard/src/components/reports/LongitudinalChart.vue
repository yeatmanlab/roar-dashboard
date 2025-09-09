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
  },
  taskId: {
    type: String,
    required: true
  },
  grade: {
    type: Number,
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
  console.log('LongitudinalChart - Input data:', props.longitudinalData);
  
  if (!props.longitudinalData?.length) {
    console.log('No longitudinal data available');
    return { labels: [], datasets: [] };
  }

  const sortedData = [...props.longitudinalData].sort((a, b) => new Date(a.date) - new Date(b.date));
  console.log('Sorted data:', sortedData);
  
  const labels = sortedData.map(entry => formatDate(entry.date));
  console.log('Labels:', labels);
  
  // Create datasets for each score type
  const datasets = [];
  
  // Define the score types we want to show
  const scoreTypes = ['rawScore', 'percentile', 'standardScore'];

  // Create a dataset for each score type
  scoreTypes.forEach(scoreType => {
    console.log(`Processing scores for ${scoreType}:`);
    const scores = sortedData.map(entry => {
      const score = entry.scores?.[scoreType];
      console.log(`- Entry scores:`, entry.scores, `Score for ${scoreType}:`, score);
      return score || null;
    });

    console.log(`Final scores for ${scoreType}:`, scores);

    // Only add the dataset if we have at least one valid score
    if (scores.some(score => score !== null)) {
      datasets.push({
        label: formatScoreType(scoreType),
        data: scores,
        fill: false,
        tension: 0.4,
        borderColor: getColorForType(scoreType),
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }
  });

  console.log('Final datasets:', datasets);
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
