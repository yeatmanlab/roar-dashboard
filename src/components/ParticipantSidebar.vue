<template>
  <div class="sidebar-container">
    <Chart type="doughnut" :data="chartData" :options="chartOptions"/>
    <div class="flex" style="flex-direction: column">
      <!-- <span>You have completed</span> -->
      <span style="font-size: 1.75rem">{{ completedGames }}/{{ totalGames }}</span>
      <span>tasks completed!</span>
    </div>
    <div class="sidebar-info">
      <span>You are part of the <b>Woodside</b> Group</span>
      <h3>Student Info</h3>
      <span>
        age: 8
        grade: 2
      </span>
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
.sidebar-container {
  /* background-color: grey; */
  width: 12.5%;
  padding: 1rem;
  border-right: 1px solid #E5E5E5;
  height: calc(100vh - 105px); /* Full height minus the navbar */
}
.sidebar-info {
  border: solid 1px #e5e5e5;
  border-radius: 10px;
  background-color: #FCFCFC;
  padding: .25rem;
  margin-top: .5rem;
  /* margin: .25rem; */
}
</style>