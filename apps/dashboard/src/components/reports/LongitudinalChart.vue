<template>
  <div class="longitudinal-chart">
    <PvChart type="line" :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import PvChart from 'primevue/chart';
import { getSupportLevel } from '@/helpers/reports';

// Threshold for detecting points near a given x-value (used in axis ticks)
const POINT_PROXIMITY_THRESHOLD = 0.01;

// Cache for quick point lookup, rebuilt when longitudinalData changes
const pointsCache = computed(() => {
  const cache = new Map();
  // Assuming longitudinalData is an array of points with x-values
  props.longitudinalData.forEach(point => {
    // Replace 'x' with the actual property name for x-value in your data
    cache.set(point.x, point);
  });
  return cache;
});

// Helper function to find the nearest point in the cache
const findNearestPoint = (value) => {
  // Get all x-values from cache
  const xValues = Array.from(pointsCache.value.keys());

  // Find the closest x-value
  const nearestX = xValues.reduce((nearest, x) => {
    return Math.abs(x - value) < Math.abs(nearest - value) ? x : nearest;
  }, xValues[0]);

  // Only return if within threshold
  if (Math.abs(nearestX - value) < POINT_PROXIMITY_THRESHOLD) {
    return pointsCache.value.get(nearestX);
  }
  return null;
};

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

// Prepare sorted data
const sortedData = computed(() => {
  if (!props.longitudinalData?.length) return [];
  return [...props.longitudinalData].sort((a, b) => new Date(a.date) - new Date(b.date));
});

// Prepare chart data
const chartData = computed(() => {
  if (!sortedData.value.length) {
    return { labels: [], datasets: [] };
  }

  // Create datasets array
  const datasets = [];

  // Only show raw scores
  const scoreTypes = ['rawScore'];

  // Create a dataset for each score type
  scoreTypes.forEach((scoreType) => {
    // Filter and map data points to only include valid scores
    const validDataPoints = sortedData.value.filter((entry) => {
      const score = entry.scores?.[scoreType];
      return score !== undefined && score !== null;
    });

    // Calculate relative positions based on dates
    const mappedPoints = [];

    if (validDataPoints.length > 0) {
      const dates = validDataPoints.map((entry) => new Date(entry.date).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const dateRange = maxDate - minDate || 1; // Avoid division by zero

      validDataPoints.forEach((entry) => {
        const score = entry.scores[scoreType];
        const rawScore = entry.scores?.rawScore;
        const percentile = entry.scores?.percentile;
        const supportLevel = getSupportLevel(props.grade, percentile, rawScore, props.taskId);
        const color = supportLevel?.tag_color || getColorForType(scoreType);
        const timestamp = new Date(entry.date).getTime();
        const relativePosition = (timestamp - minDate) / dateRange;

        const point = {
          x: relativePosition,
          y: score,
          color,
          date: entry.date,
          percentile: entry.scores.percentile,
          standardScore: entry.scores.standardScore,
        };
        mappedPoints.push(point);
        // Add to cache
        pointsCache.value.set(relativePosition, point);
      });
    }

    // Only add the dataset if we have valid scores
    if (mappedPoints.length > 0) {
      datasets.push({
        label: 'Raw Score',
        data: mappedPoints,
        fill: false,
        tension: 0.4,
        borderColor: getColorForType(scoreType),
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: mappedPoints.map((point) => point.color),
        pointBorderColor: mappedPoints.map((point) => point.color),
      });
    }
  });

  return { datasets };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
        },
      },
      labels: {
        usePointStyle: true,
        padding: 15,
      },
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (tooltipItems) => {
          const item = tooltipItems[0];
          const point = item.dataset.data[item.dataIndex];
          return formatDate(point.date);
        },
        label: (context) => {
          const point = context.dataset.data[context.dataIndex];
          const lines = [];

          // Raw Score
          lines.push(`Raw Score: ${point.y}`);

          // Percentile
          if (point.percentile !== undefined && point.percentile !== null) {
            lines.push(`Percentile: ${point.percentile}`);
          }

          // Standard Score
          if (point.standardScore !== undefined && point.standardScore !== null) {
            lines.push(`Standard Score: ${point.standardScore}`);
          }

          return lines;
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
      ticks: {
        padding: 10,
      },
    },
    x: {
      type: 'linear',
      min: 0,
      max: 1,
      grid: {
        display: false,
      },
      ticks: {
        callback: function (value) {
          // Find the closest point to this position
          const dataset = this.chart.data.datasets[0];
          if (dataset) {
            const point = findNearestPoint(value);
            if (point) {
              return formatDate(point.date);
            }
          }
          return '';
        },
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
  margin: 1rem 0;
  padding: 1rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
