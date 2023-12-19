<template>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import _get from 'lodash/get';
import { computed, onMounted } from 'vue';
import embed from 'vega-embed';
import { getSupportLevel, taskDisplayNames } from '@/helpers/reports';

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
  }
});


function returnDistByGrade(runs, scoreFieldBelowSixth, scoreFieldAboveSixth) {
  for (let run of runs) {
    let stdPercentile;
    if (parseInt(run?.user?.grade) >= 6) {
      stdPercentile = run.scores[scoreFieldAboveSixth];
    } else {
      stdPercentile = run.scores[scoreFieldBelowSixth];
    }
    run.scores.stdPercentile = stdPercentile;
  }
  return runs;
}

const distByGrade = (taskId, runs, scoreFieldBelowSixth, scoreFieldAboveSixth) => {
  return {
    // description: 'ROAR Score Distribution by Grade Level',
    background: null,
    title: { text: `ROAR-${taskDisplayNames[taskId].name} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    data: { values: returnDistByGrade(runs.value, scoreFieldBelowSixth.value, scoreFieldAboveSixth.value) },

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
        sort: "ascending",
        // sort: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, ['Kindergarten']],
      },

      color: {
        field: 'scores.stdPercentile',
        type: 'quantitative',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
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
    },
  };
};


const computedRuns = computed(() => {
  if (props.runs === undefined) return [];
  return props.runs.map(({ scores, user }) => {
    let percentScore;
    if (user?.grade >= 6) {
      percentScore = _get(scores, scoreFieldAboveSixth.value);
    } else {
      percentScore = _get(scores, scoreFieldBelowSixth.value);
    }
    const { support_level } = getSupportLevel(percentScore);
    return {
      user,
      scores: {
        ...scores,
        support_level,
      },
    };
  });
});

const scoreFieldBelowSixth = computed(() => {
  if (props.taskId === 'swr') {
    return 'wjPercentile';
  } else if (props.taskId === 'sre') {
    return 'tosrecPercentile';
  } else if (props.taskId === 'pa') {
    return 'percentile';
  }

  return 'percentile';
});

const scoreFieldAboveSixth = computed(() => {
  if (props.taskId === 'swr') {
    return 'sprPercentile';
  } else if (props.taskId === 'sre') {
    return 'sprPercentile';
  } else if (props.taskId === 'pa') {
    return 'sprPercentile';
  }

  return 'percentile';
});

const draw = async () => {
  let chartSpecDist = distByGrade(props.taskId, computedRuns, scoreFieldBelowSixth, scoreFieldAboveSixth);
  await embed(`#roar-dist-chart-${props.taskId}`, chartSpecDist);
  // Other chart types can be added via this if/then pattern
};

// watch(props.scores, (val) => {
//   if (val && props.initialized) {
//     draw();
//   }
// });

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>
