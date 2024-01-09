<template>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { taskDisplayNames } from '@/helpers/reports';

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

const distByGrade = (taskId, runs) => {
  return {
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[taskId].name}`,
      subtitle: 'Distribution of Percentile By Grade',
      anchor: 'middle',
      fontSize: 18,
    },
    data: { values: runs },

    mark: 'bar',
    height: 50,
    width: 360,

    encoding: {
      facet: {
        field: 'user.grade',
        type: 'nominal',
        columns: 1,
        title: '',
        header: {
          titleColor: 'navy',
          titleFontSize: 14,
          titleAlign: 'top',
          titleAnchor: 'middle',
          labelColor: 'navy',
          labelFontSize: 14,
          labelFontStyle: 'bold',
          labelAnchor: 'middle',
          labelAngle: 0,
          labelAlign: 'left',
          labelOrient: 'left',
          labelExpr: "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')",
        },
        spacing: 10,
        sort: "ascending",
        // sort: {order: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
        // sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },

      color: {
        field: 'scores.stdPercentile',
        type: 'quantitative',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
        scale: {
          range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'],
          domain: [0, 45, 70, 100],
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
          titleFontSize: 14,
          labelFontSize: 14, // Adjust the font size for the x-axis tick labels
        },
      },

      y: {
        aggregate: 'count',
        title: 'Count',
        axis: {
          orient: 'right',
          titleFontSize: 14,
          labelFontSize: 14, // Adjust the font size for the x-axis tick labels
          format: '.0f',
        },
      },
      tooltip: [
        { field: 'scores.stdPercentile', title: 'Percentile', type: 'quantitative', format: `.0f` },
        { field: 'user.grade', title: 'Student Grade' },
      ],
    },
    resolve: {
      scale: {
        y: "independent"
      },
    },
  };
};

const draw = async () => {
  for(const run of props.runs) {
    if(!run.user?.grade) {
    console.log("u1", run)
    }
  }
  let chartSpecDist = distByGrade(props.taskId, props.runs);
  await embed(`#roar-dist-chart-${props.taskId}`, chartSpecDist);
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>
