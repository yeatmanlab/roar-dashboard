<template>
  <!-- <div v-html="html.introductionPA"></div> -->
  <div id="viz-distribution-by-grade-pa"></div>
  <div id="viz-normed-percentile-distribution-1-4-pa"></div>
  <div id="viz-normed-percentile-distribution-5-12-pa"></div>
  <div id="viz-stacked-support-by-grade-pa"></div>
</template>

<script setup>
import { onMounted } from "vue";
import embed from "vega-embed";
import { marked } from "marked";
import { useScoreStore } from "@/store/scores";
import * as markdown from "@/components/reportMarkdownPA";
import DataTable from "datatables.net-vue3";
import DataTablesLib from "datatables.net";
import { ascending } from "vega";

const scoreStore = useScoreStore();
console.log(scoreStore);

const html = Object.fromEntries(
  Object.entries(markdown).map(([k, v]) => [k, marked.parse(v(scoreStore))])
);

const globalChartConfig = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  description: "default settings to be used for all charts",
  data: {
    values: scoreStore.scores,
  },

};

const distributionByGradePA = {
  // ...globalChartConfig,
  description: "ROAR Score Distribution by Grade Level",
  title: { text: "ROAR PA Score Distribution", anchor: "middle", fontSize: 18 },
  config: { view: { stroke: "#000000", strokeWidth: 1 } },
  data: { values: scoreStore.scores },

  mark: "bar",
  height: 50,
  width: 500,

  encoding: {
    facet: {
      field: "grade",
      type: "nominal",
      columns: 1,
      title: "By Grade",
      header: {
        titleColor: "navy",
        titleFontSize: 12,
        titleAlign: "top",
        titleAnchor: "middle",
        labelColor: "navy",
        labelFontSize: 10,
        labelFontStyle: "bold",
        labelAnchor: "middle",
        labelAngle: 0,
        labelAlign: "left",
        labelOrient: "left",
        labelExpr:
          "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
        //sort: ['Kindergarten',1,2,3,4,5,6,7,8,9,10,11,12],
        //sort: "ascending",
      },
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],

      spacing: 7,
    },
    color: {
      field: "grade",
      type: "ordinal",
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      legend: null,
    },
    // thetaEstimate should be changed to ROAR score
    x: {
      bin: true,
      field: "roarTotalCorrect",
      title: "ROAR PA Total Items Correct (out of 57)",
      bin: { step: 5 },
    },
    y: { aggregate: "count", title: "count", axis: { orient: "right" } },
  },
};

const normedPercentileDistribution1to4PA = {
  // ...globalChartConfig,
  description: "Distribution of Normed Percentiles (all grades)",
  title: {
    text: "Distribution of CTOPP Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(grades k to 4)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },

  transform: [
    {  calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade1to4",
    },
    {  calculate: "datum.percentileRankCTOPP <= 15? 'Extra Support Needed': datum.percentileRankCTOPP <=30? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade5to12",
    },
    {"filter": "(datum.grade == 'Kindergarten') || (datum.grade <= 4)" },  
  ],

  mark: "bar",
  encoding: {
    x: {
      bin: true,
      field: "percentileRankCTOPP",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5, "extent":[0,100], },
      axis: { tickMinStep: 1 },
    },
    y: { aggregate: "count", title: "count of students" },
    order: { field: "order" },
    color: {
      field: "SupportGrade1to4",
      title: "Support",
      scale: {
        domain: ["Extra Support Needed", "Some Support Needed", "Average or Above Average"],
        //domain: ["At Risk", "Some Risk", "Doing Well"],
        range: ["#cc79a7", "#f0e442", "#0072b2"],
      },
      order: { field: "order", type: "nominal" },
    },
  },
};

const normedPercentileDistribution5to12PA = {
  // ...globalChartConfig,
  description: "Distribution of Normed Percentiles (all grades)",
  title: {
    text: "Distribution of CTOPP Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(grades 5 to 12)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },

  transform: [
    {  calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade1to4",
    },
    {  calculate: "datum.percentileRankCTOPP <= 15? 'Extra Support Needed': datum.percentileRankCTOPP <=30? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade5to12",
    },
    {"filter": "datum.grade >= 5" },  
  ],

  mark: "bar",
  encoding: {
    x: {
      bin: true,
      field: "percentileRankCTOPP",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5, "extent":[0,100], },
      axis: { tickMinStep: 1 },
    },
    y: { aggregate: "count", title: "count of students" },
    order: { field: "order" },
    color: {
      field: "SupportGrade5to12",
      title: "Support",
      scale: {
        domain: ["Extra Support Needed", "Some Support Needed", "Average or Above Average"],
        //domain: ["At Risk", "Some Risk", "Doing Well"],
        range: ["#cc79a7", "#f0e442", "#0072b2"],
      },
      order: { field: "order", type: "nominal" },
    },
  },
};

const stackedSupportByGradePA = {
  description: "Distribution of Support Classification by Grade Level",
  title: {
    text: "Distribution of Support Classification by Grade Level",
    anchor: "middle",
    fontSize: 18,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    {  calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade1to4",
    },
    {  calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
       as: "SupportGrade5to12",
    },
    {
      calculate:
      "(datum.grade >=5)? datum.SupportGrade5to12 :datum.SupportGrade1to4 ",
      as: "Support",
    },
    {
      calculate:
        "indexof(['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'], datum.Support)",
      as: "order",
    },
  ],
  mark: "bar",
  encoding: {
    x: { aggregate: "count", title: "# of students", axis: { tickMinStep: 5,  } },
    y: {
      bin: false,
      type: "ordinal",
      field: "grade",
      title: "grade",
      axis: { tickBand: "extent", tickMinStep: 1 },
    },
    color: {
      field: "Support",
      type: "nominal",
      scale: {
        domain: [
          "Extra Support Needed",
          "Some Support Needed",
          "Average or Above Average",
        ],
        range: ["#cc79a7", "#f0e442", "#0072b2"],
      },
      title: "Support",
    },
    order: { field: "order", type: "nominal" },
  },
};

const draw = async () => {
  await embed('#viz-distribution-by-grade-pa', distributionByGradePA);
  await embed('#viz-normed-percentile-distribution-1-4-pa',normedPercentileDistribution1to4PA);
  await embed('#viz-normed-percentile-distribution-5-12-pa',normedPercentileDistribution5to12PA);
  await embed("#viz-stacked-support-by-grade-pa", stackedSupportByGradePA);
};

onMounted(() => {
  draw();
});
</script>

<style>
p {
  text-align: left;
  font-family: "Source Sans Pro", "Helvetica Neue", "Palatino Linotype",
    sans-serif;
}
</style>
