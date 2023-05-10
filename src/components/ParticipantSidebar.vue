<template>
  <div class="sidebar-container">
    <Chart type="doughnut" :data="chartData" :options="chartOptions"/>
    <div class="flex" style="flex-direction: column; text-align: center;">
      <span style="font-size: 1.75rem">{{ completedGames }}/{{ totalGames }}</span>
      <span>tasks completed!</span>
    </div>
    <div class="sidebar-info">
      <div style="font-weight: bold">Student Info</div>
      <div>Group: Woodside</div>
      <div>Age: 8</div>
      <div>Grade: 3</div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  totalGames: {required: true, default: 0},
  completedGames: {required: true, default: 0}
})

onMounted(() => {
    chartData.value = setChartData();
});

const chartData = ref();
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

const setChartData = () => {
  return {
    labels: ['Finished', 'Unfinished'],
    datasets: [
      {
        data: [2, 4],
        backgroundColor: ['green', '#E5E5E5'],
        hoverBackgroundColor: ['green', '#E5E5E5']
      }
    ]
  };
};
</script>
<style scoped>
.p-chart {
  padding: 1rem;
}
.sidebar-container {
  /* background-color: grey; */
  margin-bottom: auto;
  width: 200px;
  border: 1px solid var(--surface-d);
  border-radius: 5px;
  height: auto; /* Full height minus the navbar */
}
.sidebar-info {
  border-bottom-right-radius: 5px;
  border-bottom-left-radius: 5px;
  border-top: solid 1px var(--surface-d);
  background-color: var(--surface-b);
  padding: 1rem;
  margin-top: 1rem;
}
</style>