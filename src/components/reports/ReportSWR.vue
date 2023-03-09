<template>
  <div v-if="scoreStore.scoresReady">
    <!-- <VueShowdown :vue-template="true" :vue-template-data="{ ...scoreStoreRefs }" :markdown="markdownText" /> -->
    <MarkdownSWR />
  </div>
  <AppSpinner v-else />
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";
import MarkdownSWR from "@/assets/markdown/reportSWR.md";

const scoreStore = useScoreStore();

const globalChartConfig = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  description: 'default settings to be used for all charts',
  data: {
    values: scoreStore.scores,
  },
}

const distributionByGrade = {
  // ...globalChartConfig,
  description: 'ROAR Score Distribution by Grade Level',
  title: { "text": "ROAR Score Distribution by Grade Level", "anchor": "middle", "fontSize": 24 },
  "height": 75,
  "width": 600,
  data: {
    values: scoreStore.scores,
  },
  "transform": [
    { "calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score" },
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

// TODO look at the colors in this example: https://vega.github.io/vega-lite/examples/bar_heatlane.html
const normedPercentileDistribution = {
  // ...globalChartConfig,
  description: 'Distribution of Normed Percentiles (all grades)',
  title: { "text": "Distribution of Woodcock-Johnson Equivalent Percentiles", "anchor": "middle", "fontSize": 24 },
  "height": 200,
  "width": 600,
  data: { values: scoreStore.scores, },
  "transform": [
    //TODO replace fake calculation with real percent conversion
    { "calculate": "100 * (datum.thetaEstimate +4)/8", "as": "swr_percentile" },
  ],
  mark: 'bar',
  encoding: {
    // thetaEstimate should be changed to percentile
    x: {
      bin: true,
      field: 'swr_percentile',
      "title": "Percentile (relative to national norms)",
      "scale": { "domain": [0, 100] },
      "bin": { "step": 5 },
    },
    y: { aggregate: 'count', "title": "count of students" },
    //"color": {"condition": {"test": "datum['swr_score'] < 500", "value": "black"},"value": "red"},
  },
};

const stackedSupportByGrade = {
  description: 'Distribution of Support Classificaiton by Grade Level',
  title: { "text": "Distribution of Support Classificaiton by Grade Level", "anchor": "middle", "fontSize": 24 },
  "height": 200,
  "width": 600,
  data: { values: scoreStore.scores, },
  "transform": [
    { "calculate": "100 * (datum.thetaEstimate +5)", "as": "swr_score" },
    //{"filter": "datum.swr_score > 60"}
  ],
  mark: 'bar',
  encoding: {
    x: { aggregate: 'count', "title": "# of students" },
    y: {
      bin: true,
      field: 'grade',
      "title": "grade",
      "axis": { "tickBand": "extent" },
    },
  },
};

const moveTableElements = () => {
  const dataTableDiv = document.getElementById("dt-table");
  const targetDiv = document.getElementById("table-student-scores");
  if (dataTableDiv !== null) {
    targetDiv?.appendChild(dataTableDiv);
  }
}

const draw = async () => {
  await embed('#viz-distribution-by-grade', distributionByGrade);
  await embed('#viz-normed-percentile-distribution', normedPercentileDistribution);
  await embed('#viz-stacked-support-by-grade', stackedSupportByGrade);
};

onMounted(() => {
  moveTableElements();
  draw()
})
</script>

<style>
p {
  text-align: left;
}

li {
  text-align: left;
}
</style>
