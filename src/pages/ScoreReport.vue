<template>
  <h1>{{ scoreStore.taskId }}</h1>
  <p>This is an introductory paragraph. Score reports are amazing!</p>
  <div id="distribution-by-grade"></div>
  <p>This is another exquisitely written paragraph!</p>
  <div id="normed-percentile-distribution"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";

const scoreStore = useScoreStore();
const globalChartConfig = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: {
    values: scoreStore.scores,
  },
}

const distributionByGrade = {
  ...globalChartConfig,
  description: 'ROAR Score Distribution by Grade Level',
  mark: 'bar',
  encoding: {
    row: { field: "grade" },
    // thetaEstimate should be changed to ROAR score
    x: { bin: true, field: 'thetaEstimate' },
    y: { aggregate: 'count' },
    color: { field: 'grade' },
  },
};

const normedPercentileDistribution = {
  ...globalChartConfig,
  description: 'Distribution of Normed Percentiles (all grades)',
  mark: 'bar',
  encoding: {
    // thetaEstimate should be changed to percentile
    x: { bin: true, field: 'thetaEstimate'},
    y: { aggregate: 'count' },
  },
}

const draw = async () => {
  await embed('#distribution-by-grade', distributionByGrade);
  await embed('#normed-percentile-distribution', normedPercentileDistribution);
};

onMounted(() => {
  draw()
})
</script>

<style>
</style>