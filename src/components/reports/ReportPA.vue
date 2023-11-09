<template>
  <div v-if="scoreStore.scoresReady">
    <VueShowdown :vue-template="true" :vue-template-data="{ ...scoreStoreRefs }" :markdown="markdownText" />
  </div>
  <AppSpinner v-else />
</template>

<script setup>
import { onMounted } from "vue";
import embed from "vega-embed";
import { useScoreStore } from "@/store/scores";
import markdownText from "@/assets/markdown/reportPA.md?raw";

const scoreStore = useScoreStore();
const distributionByGradePA = {
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
    // TODO thetaEstimate should be changed to ROAR score
    x: {
      field: "roarTotalCorrect",
      title: "ROAR PA Total Items Correct (out of 57)",
      bin: { step: 5 },
    },
    y: { aggregate: "count", title: "count", axis: { orient: "right" } },
  },
};

const stackedSkillByGradePA = {
  description: "Distribution of Skill Classification by Grade Level",
  title: {
    text: "Distribution of Skill Classification ",
    subtitle: "By grade",
    anchor: "middle",
    fontSize: 18,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    {
      calculate:
        "indexof(['No Mastery', 'Some Mastery', 'Beginning to Exhibit Full Mastery', 'Full Mastery'], datum.skillSummary)",
      as: "order",
    },
  ],
  mark: "bar",
  encoding: {
    x: { aggregate: "count", title: "# of students", axis: { tickMinStep: 5, } },
    y: {
      bin: false,
      type: "ordinal",
      field: "grade",
      title: "grade",
      axis: { tickBand: "extent", tickMinStep: 1 },
    },
    color: {
      field: "skillSummary",
      type: "nominal",
      scale: {
        domain: [
          'No Mastery',
          'Some Mastery',
          'Beginning to Exhibit Full Mastery',
          'Full Mastery',
        ],
        //range: ["#aa4599","#342288", "#88ccee", "#44aa99"],
        range: ["#aa4599", "#F8E768", "#b4ddd1", "#44aa99"],

      },
      title: "Skill Classification",
    },
    order: { field: "order", type: "nominal" },
  },
};

const skillFocusByGradePA = {
  description: "Skills to Focus On by Grade Level",
  title: {
    text: "Skills to Focus On",
    subtitle: "by grade level",
    anchor: "middle",
    fontSize: 18,
  },
  height: 400,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    // convert mastery to focus so we can use sum to count the number who need to work on the skill
    { calculate: "(datum.masteryFSM==0)?1:0", as: "FSM" },
    { calculate: "(datum.masteryLSM==0)?1:0", as: "LSM" },
    { calculate: "(datum.masteryDEL==0)?1:0", as: "DEL" },
  ],
  "repeat": { "layer": ["FSM", "LSM", "DEL"] },
  "spec": {
    "mark": "bar",
    "encoding": {

      "y": {
        "field": "grade",
        "type": "nominal",
        axis: { labelAngle: "0" },
      },
      "x": {
        "aggregate": "sum",
        "field": { "repeat": "layer" },
        "type": "quantitative",
        "title": "# of students"
      },
      "color": {
        "datum": { "repeat": "layer" },
        "title": "Skill",
        scale: { range: ["#be95c4", "#5e548e", "#0072b2",] },
      },
      "yOffset": { "datum": { "repeat": "layer" } }
    }
  },
  "config": {
    "mark": { "invalid": null }
  }
};

const normedPercentileDistribution1to4PA = {
  description: "Distribution of Normed Percentiles (all grades)",
  title: {
    text: "Distribution of CTOPP Equivalent Percentiles",
    anchor: "middle",
    fontSize: 18,
    subtitle: "(grades K to 4)",
    subtitleFontStyle: "bold",
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },

  transform: [
    {
      calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
      as: "SupportGrade1to4",
    },
    {
      calculate: "datum.percentileRankCTOPP <= 15? 'Extra Support Needed': datum.percentileRankCTOPP <=30? 'Some Support Needed': 'Average or Above Average' ",
      as: "SupportGrade5to12",
    },
    { "filter": "(datum.grade == 'Kindergarten') || (datum.grade <= 4)" },
  ],

  mark: "bar",
  encoding: {
    x: {
      field: "percentileRankCTOPP",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5, "extent": [0, 100], },
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
    {
      calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
      as: "SupportGrade1to4",
    },
    {
      calculate: "datum.percentileRankCTOPP <= 15? 'Extra Support Needed': datum.percentileRankCTOPP <=30? 'Some Support Needed': 'Average or Above Average' ",
      as: "SupportGrade5to12",
    },
    { "filter": "datum.grade >= 5" },
  ],

  mark: "bar",
  encoding: {
    x: {
      field: "percentileRankCTOPP",
      title: "Percentile (relative to national norms)",
      scale: { domain: [0, 100] },
      bin: { step: 5, "extent": [0, 100], },
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
    {
      calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
      as: "SupportGrade1to4",
    },
    {
      calculate: "datum.percentileRankCTOPP <= 25? 'Extra Support Needed': datum.percentileRankCTOPP <=50? 'Some Support Needed': 'Average or Above Average' ",
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
    x: { aggregate: "count", title: "# of students", axis: { tickMinStep: 5, } },
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
  await embed("#viz-stacked-skill-by-grade-pa", stackedSkillByGradePA);
  await embed("#viz-skill-focus-by-grade-pa", skillFocusByGradePA);
  await embed('#viz-normed-percentile-distribution-1-4-pa', normedPercentileDistribution1to4PA);
  await embed('#viz-normed-percentile-distribution-5-12-pa', normedPercentileDistribution5to12PA);
  await embed("#viz-stacked-support-by-grade-pa", stackedSupportByGradePA);
};

onMounted(() => {
  draw()
})
</script>

<style></style>