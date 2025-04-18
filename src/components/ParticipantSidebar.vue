<template>
  <div class="sidebar-container flex flex-column">
    <div class="sidebar-progress">
      <PvChart type="doughnut" :data="chartData" :options="chartOptions" />
      <div>
        <p class="sidebar-progress-totals">{{ completedGames }}/{{ totalGames }}</p>
        <p>{{ $t('participantSidebar.tasksCompleted') }}</p>
      </div>
    </div>
    <ul v-if="!_isEmpty(studentInfo)" class="sidebar-info">
      <li class="sidebar-title">
        <strong>{{ $t('participantSidebar.studentInfo') }}</strong>
      </li>
      <li>
        {{ $t('participantSidebar.grade') }}: <span class="sidebar-info-item">{{ studentInfo.grade }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import _isEmpty from 'lodash/isEmpty';
import PvChart from 'primevue/chart';
import type { ChartData, ChartOptions } from 'chart.js'; // Import Chart.js types

// Basic interface for studentInfo, refine as needed
interface StudentInfo {
  grade?: string | number; // Allow string or number, make optional if sometimes absent
  // Add other known properties here
}

// Define props with TypeScript
interface Props {
  totalGames: number;
  completedGames: number;
  studentInfo: StudentInfo;
}

// Using withDefaults to handle default values is preferred with <script setup>
// Note: The original defaults were 0, but required: true was also set.
// If they are truly required, defaults aren't strictly necessary, but good practice.
const props = withDefaults(defineProps<Props>(), {
  totalGames: 0,
  completedGames: 0,
  studentInfo: () => ({}), // Default to an empty object for studentInfo
});

// Type for ChartData (adjust based on actual structure if different)
const chartData: ComputedRef<ChartData<'doughnut', number[], string>> = computed(() => {
  const completed = props.completedGames;
  const incomplete = props.totalGames - props.completedGames;
  return setChartData(completed, incomplete);
});

// Type for ChartOptions
const chartOptions: Ref<ChartOptions<'doughnut'>> = ref({
  cutout: '60%',
  // showToolTips: false, // Deprecated in Chart.js 3+? Use tooltip options instead
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false, // Replaces showToolTips
    },
  },
  // Remove interaction options if chart should be static
  events: [], // Disable all events like hover, click
});

// Type the function signature
const setChartData = (completed: number, incomplete: number): ChartData<'doughnut', number[], string> => {
  let docStyle = getComputedStyle(document.documentElement);

  return {
    labels: ['Finished', 'Unfinished'],
    datasets: [
      {
        data: [completed, incomplete],
        backgroundColor: [docStyle.getPropertyValue('--bright-green'), docStyle.getPropertyValue('--surface-d')],
        // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')] // Hover effects disabled by events: []
      },
    ],
  };
};
</script>

<style scoped lang="scss">
.sidebar-container {
  margin-bottom: auto;
  width: 200px;
  border: 1px solid var(--surface-d);
  border-radius: 5px;
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
@media screen and (max-width: 1100px) {
  .sidebar-container {
    width: 150px;
  }
}

.sidebar-progress {
  // text-align: center;
  padding-bottom: 0.5rem;
  width: 120px;

  p {
    margin-block: 0;
    text-align: center;
  }

  .p-chart {
    padding: 1.25rem;
    pointer-events: none;
    /* don't allow pointer events on chart */
    margin-bottom: 0.5rem;
  }

  .sidebar-progress-totals {
    font-size: 1.25rem;
  }
}

.sidebar-info {
  border-top: solid 1px var(--surface-d);
  padding: 1rem;
  margin-top: 1rem;
  list-style: none;
  margin-bottom: 0;
  line-height: 1.5;
  width: 100%;

  .sidebar-title {
    border-bottom: 1px solid var(--surface-d);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
}
</style>
