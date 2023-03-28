<template>
  <div v-if="scoreStore.scoresReady">
    <VueShowdown
      :vue-template="true"
      :vue-template-data="{ ...scoreStoreRefs }"
      :markdown="markdownText"
    />
  </div>
  <AppSpinner v-else />
</template>

<script setup>
import { onMounted } from "vue";
import embed from "vega-embed";
import { useScoreStore } from "@/store/scores";
import { storeToRefs } from "pinia";
import markdownText from "@/assets/markdown/reportSRE.md?raw";
import TableRoarScores from "./TableRoarScores.vue";

const scoreStore = useScoreStore();
const scoreStoreRefs = storeToRefs(scoreStore);

const globalChartConfig = {
  description: "default settings to be used for all charts",
  data: { values: scoreStore.scores, },
};

const distributionByGrade = {
  // ...globalChartConfig,
  description: "ROAR Score Distribution by Grade Level",
  title: { text: "ROAR Score Distribution", anchor: "middle", fontSize: 20 },
  config: { view: { stroke: "#000000", strokeWidth: 1 } },
  data: { values: scoreStore.scores },
  mark: { type: "bar", stroke: "black" },
  height: 60,
  width: 600,
  encoding: {
    facet: {
      field: "runInfoCommon.grade",
      type: "nominal",
      columns: 1,
      title: "By Grade",
      header: {
        titleColor: "navy",
        titleFontSize: 14,
        titleAlign: "top",
        titleAnchor: "middle",
        labelColor: "navy",
        labelFontSize: 12,
        labelFontStyle: "bold",
        labelAnchor: "middle",
        labelAngle: 0,
        labelAlign: "left",
        labelOrient: "left"
      },
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      spacing: 7,
    },
    color: {
      field: "runInfoCommon.grade",
      type: "ordinal",
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      legend: null,
    },
    x: { bin: true, field: "runInfoCommon.roarScore", title: "SRE Score", bin: { step: 50 }, axis: { titleFontSize: 14 }  },
    y: { aggregate: "count", title: "Count", titleFontSize: 10, axis: { orient: "right", titleFontSize: 1 } },
  }
};

const tosrecPercentileDistribution = {
  // ...globalChartConfig,
  description: "Distribution of Normed Percentiles (all grades)",
  title: {
    text: "Distribution of TOSREC Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(all grades)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 400,
  width: 700,
  data: { values: scoreStore.scores },
  layer: [
    {
      params: [
        { name: "hover", 
          select: {type: "point", on: "mouseover", clear: "mouseout" } 
        }
      ],
      mark: { type: "bar", stroke: "black", tooltip: true },
      encoding: {
        tooltip: [
          { field: "runInfoCommon.normedPercentile", type: "quantitative", title: "Percentile Range"},
          { field: "runInfoTest.supportLevel", type: "ordinal", title: "Support Level" },
          { aggregate: "count", type: "quantitative", title: "Count of Students" }
        ],
        opacity: {
          condition: { test: { param: "hover", empty: false}, value: 0.5 },
          value: 0
        }
      }
    },
    {
      mark: { type: "bar", stroke: "black", tooltip: true },
    }
  ],
  encoding: {
    x: {
      bin: true,
      field: "runInfoCommon.normedPercentile",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 2 },
      axis: { tickMinStep: 1, titleFontSize: 14 },
    },
    y: { aggregate: "count", title: "Count of Students", axis: { titleFontSize: 14 } },
    color: {
      field: "runInfoTest.supportLevel",
      title: "TOSREC Classification",
      sort: [
        "Very Low",
        "Low",
        "Below Average",
        "Average",
        "Above Average",
      ],
      scale: {
        domain: [
          "Very Low",
          "Low",
          "Below Average",
          "Average",
          "Above Average",
        ],
        range: ["#cc79a7", "#de8e08", "#f0e442", "#0072b2", "#053e6e"],
      },
      legend: { symbolOpacity: 1 }
    },
  },
};

const stackedClassificationByGrade = {
  description: "Distribution of TOSREC Classification by Grade Level",
  title: {
    text: "Distribution of TOSREC Classification",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(by grade)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 400,
  width: 800,
  data: { values: scoreStore.scores },
  layer: [
    {
      params: [
        { name: "hover", 
          select: {type: "point", on: "mouseover", clear: "mouseout" } 
        }
      ],
      mark: { type: "bar", stroke: "black", tooltip: true },
      encoding: {
        tooltip: [
          { field: "runInfoCommon.grade", type: "ordinal", title: "Grade"},
          { field: "runInfoTest.supportLevel", type: "ordinal", title: "Support Level" },
          { aggregate: "count", type: "quantitative", title: "Count of Students" }
        ],
        opacity: {
          condition: { test: { param: "hover", empty: false}, value: 0.5 },
          value: 0
        }
      }
    },
    {
      mark: { type: "bar", stroke: "black", tooltip: true },
    }
  ],
  transform: [
    { calculate:
        "indexof(['Very Low', 'Low', 'Below Average', 'Average', 'Above Average'], datum.runInfoTest.supportLevel)",
      as: "order",
    }
  ],
  encoding: {
    x: { aggregate: "count", title: "# of Students", axis: { tickMinStep: 1, titleFontSize: 14 } },
    y: {
      bin: false,
      type: "ordinal",
      field: "runInfoCommon.grade",
      title: "Grade",
      axis: { tickBand: "extent", tickMinStep: 1, titleFontSize: 14 },
      sort: ["Kindergarten", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    color: {
      field: "runInfoTest.supportLevel",
      type: "nominal",
      scale: {
        sort: [
          "Very Low",
          "Low",
          "Below Average",
          "Average",
          "Above Average",
        ],
        domain: [
          "Very Low",
          "Low",
          "Below Average",
          "Average",
          "Above Average",
        ],
        range: ["#cc79a7", "#de8e08", "#f0e442", "#0072b2", "#053e6e"],
      },
      title: "TOSREC Classifications", 
      legend: { symbolOpacity: 1 }
    },
    order: { field: "order", type: "ordinal" }
  },
};


const draw = async () => {
  await embed("#viz-distribution-by-grade", distributionByGrade);
  await embed("#viz-tosrec-distribution-across-grade", tosrecPercentileDistribution);
  await embed("#viz-stacked-tosrec-classification", stackedClassificationByGrade);
};

onMounted(() => {
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
