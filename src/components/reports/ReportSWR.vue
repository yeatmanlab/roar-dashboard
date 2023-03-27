<template>
  <div v-if="scoreStore.scoresReady">

    <!-- <VueShowdown :vue-template="true" :vue-template-data="{ ...scoreStoreRefs }" :markdown="markdownText" /> -->
    <MarkdownSWR :scores="scoreStore.scores" :swrStats="scoreStore.swrStats" :columns="tableColumns" />

  </div>
  <AppSpinner v-else />
</template>

<script setup>

import { onMounted, ref } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";

import MarkdownSWR from "@/assets/markdown/reportSWR.md";


const scoreStore = useScoreStore();

console.log(scoreStore);


const tableColumns = ref([
  {
    "field": "runInfoOrig.name.first", 
    "header": "First Name", 
    "allowMultipleFilters": true,
    "dataType": "text",
  },
  {
    "field": "runInfoOrig.name.last", 
    "header": "Last Name", 
    "allowMultipleFilters": true,
    "dataType": "text",
  },
  {
    "field": "runInfoCommon.parsedGrade", 
    "header": "Grade", 
    "allowMultipleFilters": true,
    "dataType": "text",
    "useMultiSelect": true
  },
  {
    "field": "runInfoCommon.roarScore", 
    "header": "SWR ROAR SCORE", 
    "dataType": "numeric",
  },
  // {
  //   "field": "runInfoCommon.normedPercentile", 
  //   "header": "Estimated Woodcock-Johnson Percentile", 
  //   "dataType": "numeric",
  // },
    // {
  //   "field": "runInfoCommon.normedStandardScore", 
  //   "header": "Estimated Woodcock-Johnson Standard Score", 
  //   "dataType": "numeric",
  // },
  {
    "field": "runInfoCommon.supportLevel", 
    "header": "Support Level", 
    "dataType": "text",
  },
]);


const globalChartConfig = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  // TODO look at the colors in this example: https://vega.github.io/vega-lite/examples/bar_heatlane.html
  description: "default settings to be used for all charts",
  data: {
    values: scoreStore.scores,
  },
};

const distributionByGrade = {
  // ...globalChartConfig,
  description: "ROAR Score Distribution by Grade Level",
  title: { text: "ROAR Score Distribution", anchor: "middle", fontSize: 18 },
  config: { view: { stroke: "#000000", strokeWidth: 1 } },
  data: { values: scoreStore.scores},

  mark: "bar", 
  height: 50,
  width: 500,

  encoding: {
    facet: {
      field: "runInfoOrig.grade",
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
        labelExpr: "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
        //sort: ['Kindergarten',1,2,3,4,5,6,7,8,9,10,11,12],    // TODO why is sort not working?
        //sort: "ascending",
      },

      //sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      spacing: 7,
    },

    color: {
      field: "runInfoOrig.grade",
      type: "ordinal",
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      legend: null,
    },

    x: {
      bin: true,
      field: "runInfoCommon.roarScore",
      title: "ROAR Score",
      bin: { step: 50 },
    },
    
    y: { aggregate: "count", 
         title: "count", 
         axis: { orient: "right" } },
  },
};

const normedPercentileDistribution = {
  // ...globalChartConfig,
  description: "Distribution of Normed Percentiles (all grades)",
  title: {
    text: "Distribution of Woodcock-Johnson Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(all grades)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  mark: "bar",
  encoding: {
    // thetaEstimate should be changed to percentile
    x: {
      bin: true,
      field: "runInfoCommon.normedPercentile",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5 },
      axis: { tickMinStep: 1 },
    },
    y: { aggregate: "count", title: "count of students" },
    color: {
      field: "runInfoCommon.supportLevel",
      title: "Support",
      sort: [
        "Extra Support Needed",
        "Some Support Needed",
        "Average or Above Average",
      ],
      scale: {
        domain: [
          "Extra Support Needed",
          "Some Support Needed",
          "Average or Above Average",
        ],
        range: ["#cc79a7", "#f0e442", "#0072b2"],
      }, 
    },
  },
};

const firstGradePercentileDistribution = {
  // ...globalChartConfig,
  description:
    "Distribution of First Grade Woodcock-Johnson Equivalent Percentiles",
  title: {
    text: "Distribution of Woodcock-Johnson Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "Kindergarten and 1st Grade",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 100,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    { filter: "(datum.runInfoOrig.grade == 'Kindergarten') || (datum.runInfoOrig.grade <= 1)" },
  ],
  mark: "bar",
  encoding: {
    x: {
      bin: true,
      field: "runInfoCommon.normedPercentile",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5, minstep: 1, extent: [0, 100] },
      axis: { tickMinStep: 1 },
    },
    y: {
      aggregate: "count",
      title: "count of students",
      axis: { tickMinStep: 1 },
    },
    color: {
      field: "runInfoCommon.supportLevel",
      title: "Automaticity",
      sort: ["Limited", "Average or Above Average"],
      scale: {
        //domain: ["Limited", "Average or Above Average"],
        range: ["#342288", "#44aa99"],
      },
    },
  },
};

const stackedSupportByGrade = {
  description: "Distribution of Support Classification by Grade Level",
  title: {
    text: "Distribution of Support Classification",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(by grade)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    {
      calculate:
        "indexof(['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'], datum.runInfoCommon.supportLevel)",
      as: "order",
    },
    { filter: "datum.runInfoOrig.grade >= 2" },
  ],
  mark: "bar",
  encoding: {
    x: { aggregate: "count", title: "# of students", axis: { tickMinStep: 1 } },
    y: {
      bin: false,
      type: "nominal",
      field: "runInfoOrig.grade",
      title: "grade",
      axis: { tickBand: "extent", tickMinStep: 1 },
    },
    color: {
      field: "runInfoCommon.supportLevel",
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

const stackedAutomaticityFirstGrade = {
  description: "Distribution of Automaticity in First Grade",
  title: {
    text: "Distribution of Automaticity",
    subtitle: ("Kindergarten and 1st grade"),
    anchor: "middle",
    fontSize: 18,
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 100,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    { calculate: "indexof(['Limited', 'Average or Above Average'], datum.Automaticity)", as: "order",},
    { filter: "(datum.runInfoOrig.grade == 'Kindergarten') || (datum.runInfoOrig.grade <= 1)" },
  ],
  mark: "bar",
  encoding: {
    x: {
      aggregate: "count",
      title: "# of students",
      axis: { tickBand: "extent", tickMinStep: 1 },
    },
    y: {
      bin: false,
      field: "runInfoOrig.grade",
      title: "grade",
      axis: { 
        tickBand: "extent", 
        labelExpr: "join([if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')", 
      },

    },
    color: {
      field: "runInfoCommon.supportLevel",
      type: "nominal",
      scale: {
        domain: ["Limited", "Average or Above Average"],
        range: ["#342288", "#44aa99"],
      },
      title: "Automaticity",
    },
    order: { field: "order", type: "nominal" },
  },
};

const moveTableElements = () => {
  const dataTableDiv = document.getElementById("dt-table");
  const targetDiv = document.getElementById("table-student-scores");
  if (dataTableDiv !== null) {
    targetDiv?.appendChild(dataTableDiv);
  }
};

const draw = async () => {
  await embed("#viz-distribution-by-grade", distributionByGrade);
  await embed("#viz-normed-percentile-distribution", normedPercentileDistribution);
  await embed("#viz-first-grade-percentile-distribution",firstGradePercentileDistribution);
  await embed("#viz-stacked-support-by-grade", stackedSupportByGrade);
  await embed("#viz-automaticity-distributions-first-grade",stackedAutomaticityFirstGrade);
};

onMounted(() => {
  moveTableElements();
  draw();
});
</script>

<style>
p {
  text-align: left;
  font-size:medium;
  font-family: "Helvetica Neue", "Source Sans Pro", "Palatino Linotype",
    sans-serif;

}

li {
  text-align: left;
}
</style>
