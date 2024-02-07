<template>
  <div class="view-by-wrapper mx-2">
    <div class="flex uppercase text-xs font-light">view scores by</div>
    <PvSelectButton
      v-model="scoreMode"
      :allow-empty="false"
      class="flex flex-row my-2 select-button"
      :options="scoreModes"
      option-label="name"
      @change="handleModeChange"
    />
  </div>
  <!-- </div> -->
  <div :id="`roar-distribution-chart-${taskId}`"></div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
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
  facetMode: {
    type: Object,
    required: true,
    default() {
      return { name: 'Grade', key: 'grade' };
    },
  },
  runs: {
    type: Array,
    required: true,
  },
});

const scoreMode = ref({ name: 'Raw Score', key: 'rawScore' });
const scoreModes = [
  { name: 'Raw Score', key: 'rawScore' },
  { name: 'Percentile', key: 'stdPercentile' },
];

const getBinSize = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 10;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return 5;
    else if (taskId === 'sre') return 10;
    else if (taskId === 'swr') return 50;
  }
  return 10;
};

const getRangeLow = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 0;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return 0;
    else if (taskId === 'sre') return 0;
    else if (taskId === 'swr') return 100;
  }
  return 0;
};

const getRangeHigh = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 100;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return 57;
    else if (taskId === 'sre') return 130;
    else if (taskId === 'swr') return 900;
  }
  return 100;
};

const distributionChartFacet = (taskId, runs) => {
  return {
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[taskId].name}`,
      subtitle: `${scoreMode.value.name} Distribution By ${props.facetMode.name}`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: runs,
    },
    mark: 'bar',
    height: 50,
    width: 360,
    encoding: {
      row: {
        field: props.facetMode.key === 'grade' ? `grade` : `user.${props.facetMode.key}`,
        type: 'ordinal',
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
          labelExpr:
            props.facetMode.name === 'Grade'
              ? "join(['Grade ',if(datum.value == '0', 'K', datum.value ), ], '')"
              : 'slice(datum.value, 1, datum.value.length)',
          labelLimit: 150,
          labelSeparation: 5, // Set the spacing between lines in pixels
        },
        spacing: 10,
        sort: 'ascending',
      },

      color: {
        field: `scores.${scoreMode.value.key}`,
        scheme: 'blues',
        type: 'quantitative',
        legend: null,
        scale: {
          range:
            scoreMode.value.name === 'Percentile'
              ? ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green']
              : ['#ADD8E6', '#000080'],
          domain: scoreMode.value.name === 'Percentile' ? [0, 45, 70, 100] : '',
        },
      },

      x: {
        field: `scores.${scoreMode.value.key}`,
        title: scoreMode.value.name === 'Percentile' ? `${scoreMode.value.name} Score` : `${scoreMode.value.name}`,
        bin: { step: getBinSize(scoreMode.value.name, taskId), extent: [getRangeLow(scoreMode.value.name, taskId), getRangeHigh(scoreMode.value.name, taskId)] },
        sort: 'ascending',
        axis: {
          labelAngle: 0,
          labelAlign: 'center',
          titleFontSize: 14,
          labelFontSize: 14,
        },
      },

      y: {
        aggregate: 'count',
        title: 'Count',
        axis: {
          orient: 'right',
          titleFontSize: 14,
          labelFontSize: 14,
          format: '.0f',
        },
      },
      tooltip: [
        {
          field: `scores.${scoreMode.value.key}`,
          title: `${scoreMode.value.name}`,
          type: 'quantitative',
          format: `.0f`,
        },
        { field: 'user.grade', title: 'Student Grade' },
        { aggregate: 'count', title: 'Student Count' },
      ],
    },
    resolve: {
      scale: {
        y: 'independent',
      },
    },
  };
};

const draw = async () => {
  let chartSpecDist = distributionChartFacet(props.taskId, props.runs);
  await embed(`#roar-distribution-chart-${props.taskId}`, chartSpecDist);
};

watch(
  () => props.facetMode,
  () => {
    draw();
  },
);

const handleModeChange = () => {
  draw();
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>

<style lang="scss">
.view-by-wrapper {
  display: flex;
  flex-direction: column;
  align-items: space-around;
}

.distribution-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  height: 100%;
}
</style>
