<template>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { taskDisplayNames } from '@/helpers/reports';

const graphColorType = {
  mediumPink: '#cc79a7',
  mediumYellow: '#f0e442',
  mediumBlue: '#0072b2',
  lightBlueGreen: '#44aa99',
  darkPurple: '#342288',
  black: '#000000',
};

const props = defineProps({
  initialized: {
    type: Boolean,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
  administrationId: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    required: false,
    default: 'percentage',
  },
  runs: {
    type: Array,
    required: true,
  },
});

const distByGrade = (taskId, runs ) => {
  return {
    // description: 'ROAR Score Distribution by Grade Level',
    background: null,
    title: { text: `ROAR-${taskDisplayNames[taskId].name} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    // data: { values: returnDistByGrade(runs, scoreFieldBelowSixth.value, scoreFieldAboveSixth.value) },
    data: { values: runs },

    mark: 'bar',
    height: 50,
    width: 330,

    encoding: {
      facet: {
        field: 'user.grade',
        type: 'nominal',
        columns: 1,
        title: 'By Percentile',
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
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },

      color: {
        field: 'scores.stdPercentile',
        type: 'quantitative',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
        scale: {
          range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'],
          domain: [0, 50, 100],
        },
      },

      x: {
        field: `scores.stdPercentile`,
        title: `Percentile`,
        bin: { step: 10, extent: [0, 100] },
        sort: 'ascending',
        axis: {
          labelAngle: 0,
          labelAlign: 'center',
        },
      },

      y: {
        aggregate: 'count',
        title: 'count',
        axis: { orient: 'right' },
      },
      tooltip: [{ field: 'scores.stdPercentile', type: 'quantitative', format: `.0f` }, { field: 'user.grade' }],
    },
  };
};

const draw = async () => {
  let chartSpecDist = distByGrade(props.taskId, props.runs);
  await embed(`#roar-dist-chart-${props.taskId}`, chartSpecDist);
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>
