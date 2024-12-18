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
<script setup>
import { ref, computed } from 'vue';
import _isEmpty from 'lodash/isEmpty';
import PvChart from 'primevue/chart';

const props = defineProps({
  totalGames: { type: Number, required: true, default: 0 },
  completedGames: { type: Number, required: true, default: 0 },
  studentInfo: { type: Object, required: true },
});

const chartData = computed(() => {
  const completed = props.completedGames;
  const incomplete = props.totalGames - props.completedGames;
  return setChartData(completed, incomplete);
});
const chartOptions = ref({
  cutout: '60%',
  showToolTips: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      enabled: false,
    },
  },
});

const setChartData = (completed, incomplete) => {
  let docStyle = getComputedStyle(document.documentElement);

  return {
    labels: ['Finished', 'Unfinished'],
    datasets: [
      {
        data: [completed, incomplete],
        backgroundColor: [docStyle.getPropertyValue('--bright-green'), docStyle.getPropertyValue('--surface-d')],
        // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
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
