<template>
  <div v-html="html.introduction"></div>
  <div id="viz-distribution-by-grade"></div>
  <div v-html="html.supportSection1"></div>
  <div id="viz-normed-percentile-distribution"></div>
  <!-- <div v-html="html.supportSection2"></div> -->
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { marked } from 'marked';
import { useScoreStore } from "@/store/scores";
import * as markdown from "@/components/reportMarkdownSWR";

const scoreStore = useScoreStore();

const html = Object.fromEntries(Object.entries(markdown).map(([k, v]) => [k, marked.parse(v(scoreStore))]));

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
  await embed('#viz-distribution-by-grade', distributionByGrade);
  await embed('#viz-normed-percentile-distribution', normedPercentileDistribution);
};

onMounted(() => {
  draw()
})
</script>

<style>
p {
  text-align: left;
}
</style>