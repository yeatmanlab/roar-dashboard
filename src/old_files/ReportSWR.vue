<template>
  <div v-if="scoreStore.scoresReady">
    <MarkdownSWR :scores="scoreStore.scores" :swr-stats="scoreStore.swrStats" :columns="tableColumns" />
  </div>
  <AppSpinner v-else />
</template>

<script setup>
import { onMounted, ref } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from '@/store/scores';
import { graphColorType, supportLevelsType, automaticityLevelsType } from './reportUtils.js';
import MarkdownSWR from '@/assets/markdown/reportSWR.md';

const scoreStore = useScoreStore();
const tableColumns = ref([
  {
    field: 'runInfoOrig.name.first',
    header: 'First Name',
    allowMultipleFilters: true,
    dataType: 'text',
  },
  {
    field: 'runInfoOrig.name.last',
    header: 'Last Name',
    allowMultipleFilters: true,
    dataType: 'text',
  },
  {
    field: 'runInfoCommon.parsedGrade',
    header: 'Grade',
    allowMultipleFilters: true,
    dataType: 'text',
    useMultiSelect: true,
  },
  {
    field: 'runInfoCommon.roarScore',
    header: 'SWR ROAR SCORE',
    dataType: 'numeric',
  },
  {
    field: 'runInfoCommon.normedPercentile',
    header: 'Estimated Woodcock-Johnson Percentile',
    dataType: 'numeric',
  },
  {
    field: 'runInfoCommon.normedStandardScore',
    header: 'Estimated Woodcock-Johnson Standard Score',
    dataType: 'numeric',
  },
  {
    field: 'runInfoCommon.supportLevel',
    header: 'Support Level',
    dataType: 'text',
  },
]);

const distributionByGrade = {
  description: 'ROAR Score Distribution by Grade Level',
  title: { text: 'ROAR Score Distribution', anchor: 'middle', fontSize: 18 },
  config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

  data: { values: scoreStore.scores },

  mark: 'bar',
  height: 50,
  width: 500,

  encoding: {
    facet: {
      field: 'runInfoOrig.grade',
      type: 'nominal',
      columns: 1,
      title: 'By Grade',
      header: {
        titleColor: 'navy',
        titleFontSize: 12,
        titleAlign: 'top',
        titleAnchor: 'middle',
        labelColor: 'navy',
        labelFontSize: 10,
        labelFontStyle: 'bold',
        labelAnchor: 'middle',
        labelAngle: 0,
        labelAlign: 'left',
        labelOrient: 'left',
        labelExpr: "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
      },

      spacing: 7,
    },

    color: {
      field: 'runInfoOrig.grade',
      type: 'ordinal',
      sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      legend: null,
    },

    x: {
      field: 'runInfoCommon.roarScore',
      title: 'ROAR Score',
      bin: { step: 50 },
    },

    y: {
      aggregate: 'count',
      title: 'count',
      axis: { orient: 'right' },
    },
  },
};

const normedPercentileDistribution = {
  description: 'Distribution of Normed Percentiles (all grades)',
  title: {
    text: 'Distribution of Woodcock-Johnson Equivalent Percentiles',
    anchor: 'middle',
    fontSize: 18,
    subtitle: '(all grades)',
    subtitleFontStyle: 'bold',
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  mark: 'bar',
  encoding: {
    // thetaEstimate should be changed to percentile
    x: {
      field: 'runInfoCommon.normedPercentile',
      title: 'Percentile (relative to national norms)',
      scale: { domain: [0, 100] },
      bin: { step: 5 },
      axis: { tickMinStep: 1 },
    },
    y: { aggregate: 'count', title: 'count of students' },
    color: {
      field: 'runInfoCommon.supportLevel',
      title: 'Support',
      sort: [supportLevelsType.extra, supportLevelsType.some, supportLevelsType.average],
      scale: {
        domain: [supportLevelsType.extra, supportLevelsType.some, supportLevelsType.average],
        range: [graphColorType.mediumPink, graphColorType.mediumYellow, graphColorType.mediumBlue],
      },
    },
  },
};

const firstGradePercentileDistribution = {
  description: 'Distribution of First Grade Woodcock-Johnson Equivalent Percentiles',
  title: {
    text: 'Distribution of Woodcock-Johnson Equivalent Percentiles',
    anchor: 'middle',
    fontSize: 18,
    subtitle: 'Kindergarten and 1st Grade',
    subtitleFontStyle: 'bold',
    subtitleFontSize: 12,
  },
  height: 100,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [{ filter: "(datum.runInfoOrig.grade == 'Kindergarten') || (datum.runInfoOrig.grade <= 1)" }],
  mark: 'bar',
  encoding: {
    x: {
      field: 'runInfoCommon.normedPercentile',
      title: 'Percentile (relative to national norms)',
      scale: { domain: [0, 100] },
      bin: { step: 5, minstep: 1, extent: [0, 100] },
      axis: { tickMinStep: 1 },
    },
    y: {
      aggregate: 'count',
      title: 'count of students',
      axis: { tickMinStep: 1 },
    },
    color: {
      field: 'runInfoCommon.supportLevel',
      title: 'Automaticity',
      sort: [automaticityLevelsType.limited, automaticityLevelsType.average],
      scale: {
        //domain: [automaticityLevelsType.limited, automaticityLevelsType.average],
        range: [graphColorType.darkPurple, graphColorType.lightBlueGreen],
      },
    },
  },
};

const stackedSupportByGrade = {
  description: 'Distribution of Support Classification by Grade Level',
  title: {
    text: 'Distribution of Support Classification',
    anchor: 'middle',
    fontSize: 18,
    subtitle: '(by grade)',
    subtitleFontStyle: 'bold',
    subtitleFontSize: 12,
  },
  height: 200,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    {
      calculate:
        "indexof(['Extra Support Needed', 'Some Support Needed', 'Average or Above Average'], datum.runInfoCommon.supportLevel)",
      as: 'order',
    },
    { filter: 'datum.runInfoOrig.grade >= 2' },
  ],
  mark: 'bar',
  encoding: {
    x: { aggregate: 'count', title: '# of students', axis: { tickMinStep: 1 } },
    y: {
      bin: false,
      type: 'nominal',
      field: 'runInfoOrig.grade',
      title: 'grade',
      axis: { tickBand: 'extent', tickMinStep: 1 },
    },
    color: {
      field: 'runInfoCommon.supportLevel',
      type: 'nominal',

      scale: {
        domain: [supportLevelsType.extra, supportLevelsType.some, supportLevelsType.average],
        range: [graphColorType.mediumPink, graphColorType.mediumYellow, graphColorType.mediumBlue],
      },
      title: 'Support',
    },
    order: { field: 'order', type: 'nominal' },
  },
};

const stackedAutomaticityFirstGrade = {
  description: 'Distribution of Automaticity in First Grade',
  title: {
    text: 'Distribution of Automaticity',
    subtitle: 'Kindergarten and 1st grade',
    anchor: 'middle',
    fontSize: 18,
    subtitleFontStyle: 'bold',
    subtitleFontSize: 12,
  },
  height: 100,
  width: 600,
  data: { values: scoreStore.scores },
  transform: [
    { calculate: "indexof(['Limited', 'Average or Above Average'], datum.Automaticity)", as: 'order' },
    { filter: "(datum.runInfoOrig.grade == 'Kindergarten') || (datum.runInfoOrig.grade <= 1)" },
  ],
  mark: 'bar',
  encoding: {
    x: {
      aggregate: 'count',
      title: '# of students',
      axis: { tickBand: 'extent', tickMinStep: 1 },
    },
    y: {
      bin: false,
      field: 'runInfoOrig.grade',
      title: 'grade',
      axis: {
        tickBand: 'extent',
        labelExpr: "join([if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
      },
    },
    color: {
      field: 'runInfoCommon.supportLevel',
      type: 'nominal',
      scale: {
        domain: [automaticityLevelsType.limited, automaticityLevelsType.average],
        range: [graphColorType.darkPurple, graphColorType.lightBlueGreen],
      },
      title: 'Automaticity',
    },
    order: { field: 'order', type: 'nominal' },
  },
};

const moveTableElements = () => {
  const dataTableDiv = document.getElementById('dt-table');
  const targetDiv = document.getElementById('table-student-scores');
  if (dataTableDiv !== null) {
    targetDiv?.appendChild(dataTableDiv);
  }
};

const draw = async () => {
  await embed('#viz-distribution-by-grade', distributionByGrade);
  await embed('#viz-normed-percentile-distribution', normedPercentileDistribution);
  await embed('#viz-first-grade-percentile-distribution', firstGradePercentileDistribution);
  await embed('#viz-stacked-support-by-grade', stackedSupportByGrade);
  await embed('#viz-automaticity-distributions-first-grade', stackedAutomaticityFirstGrade);
};

onMounted(() => {
  moveTableElements();
  draw();
});
</script>

<style scoped>
p {
  text-align: left;
  font-size: medium;
  font-family: 'Helvetica Neue', 'Source Sans Pro', 'Palatino Linotype', sans-serif;
}

li {
  text-align: left;
}
</style>
