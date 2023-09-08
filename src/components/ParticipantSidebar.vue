<template>
  <div class="sidebar-container">
    <div class="sidebar-progress">
      <Chart type="doughnut" :data="chartData" :options="chartOptions"/>
      <div>
        <p class="sidebar-progress-totals">{{ completedGames }}/{{ totalGames }}</p>
        <p>tasks completed!</p>
      </div>
    </div>
    <ul class="sidebar-info">
      <li class="sidebar-title"><strong>Student Info</strong></li>
      <li>Grade: <span class="sidebar-info-item">{{ studentInfo.grade }}</span></li>
    </ul>
  </div>
</template>
<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  totalGames: {required: true, default: 0},
  completedGames: {required: true, default: 0},
  studentInfo: {required: true}
})

const chartData = computed(() => {
  const completed = props.completedGames;
  const incomplete = (props.totalGames - props.completedGames);
  return setChartData(completed, incomplete)
});
const chartOptions = ref({
    cutout: '60%',
    showToolTips: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false
      }
    }
});

const setChartData = (completed, incomplete) => {
  let docStyle = getComputedStyle(document.documentElement);
  
  return {
    labels: ['Finished', 'Unfinished'],
    datasets: [
      {
        data: [completed, incomplete],
        backgroundColor: [
          docStyle.getPropertyValue('--bright-green'), 
          docStyle.getPropertyValue('--surface-d')
        ],
        // hoverBackgroundColor: ['green', docStyle.getPropertyValue('--surface-d')]
      }
    ]
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
  }

  .sidebar-progress {
    // text-align: center;
    padding-bottom: .5rem;
    
    p {
      margin-block: 0;
      text-align: center;
    }
    
    .p-chart {
      padding: 1.25rem;
      pointer-events: none; /* don't allow pointer events on chart */
      margin-bottom: .5rem;
    }
    
    .sidebar-progress-totals {
      font-size: 1.25rem;
    }
    
  }
  
  .sidebar-info {
    border-bottom-right-radius: 5px;
    border-bottom-left-radius: 5px;
    border-top: solid 1px var(--surface-d);
    background-color: var(--surface-b);
    padding: 1rem;
    margin-top: 1rem;
    list-style: none;
    margin-bottom: 0;
    line-height: 1.5;
    
    .sidebar-title {
      border-bottom: 1px solid var(--surface-d);
      padding-bottom: .5rem;
      margin-bottom: 1rem;
    }
  }
</style>