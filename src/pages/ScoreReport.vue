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
import { getDistributionByGrade } from "@/helpers/plotting.js"

const scoreStore = useScoreStore();

/*
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
*/

const debugGlobalChartConfig =  {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'default settings to be used for all charts',
    data: {
      values: scoreStore.scores,
    },

  };
  
  

  const debugDistributionByGrade = {
        ...debugGlobalChartConfig,
        description: 'ROAR Score Distribution by Grade Level',
        title: {"text": "ROAR Score Distribution by Grade Level", "anchor": "middle","fontSize":24},
        "height": 75,
        "width": 600,
        
        "transform": [
            {"calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score"},
            //{"filter": "datum.swr_score > 60"}
            ],
        mark: 'bar',
        encoding: {
            row: { field: "grade" },
            // thetaEstimate should be changed to ROAR score
            x: { bin: true, field: 'swr_score', "title": "ROAR Score", },
            y: { aggregate: 'count', "title": "# of students" },
            color: { field: 'grade' },
        },
        
  };

const draw = async () => {
  await embed('#distribution-by-grade', debugDistributionByGrade);
  //await embed('#distribution-by-grade', getDistributionByGrade(scoreStore.scores));
  //await embed('#normed-percentile-distribution', normedPercentileDistribution);
};

onMounted(() => {
  draw()
})
</script>

<style>
</style>