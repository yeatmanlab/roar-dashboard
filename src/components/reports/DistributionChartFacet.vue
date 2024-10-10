<template>
  <div class="distribution-wrapper">
    <div :id="`roar-distribution-chart-${taskId}`"></div>
    <div v-if="minGradeByRuns < 6" class="view-by-wrapper my-2" data-html2canvas-ignore="true">
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
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import embed from 'vega-embed';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';

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
  minGradeByRuns: {
    type: Number,
    required: true,
  },
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

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

// With Percentile View, only display runs under grade 6
const computedRuns = computed(() => {
  if (scoreMode.value.name === 'Percentile') {
    return props.runs.filter((run) => run.grade < 6);
  }
  return props.runs;
});

const distributionChartFacet = computed(() => {
  if (isLoadingTasksDictionary.value) return {};
  return {
    background: null,
    title: {
      text: `${tasksDictionary.value[props.taskId]?.publicName ?? props.taskId}`,
      subtitle: `${scoreMode.value.name} Distribution By ${props.facetMode.name}`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: computedRuns.value,
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
          labelFontStyle: '',
          labelAnchor: 'top',
          labelAngle: 0,
          labelAlign: 'right',
          labelOrient: 'left',
          labelBaseline: 'line-bottom',
          labelPadding: 0,
          labelExpr:
            props.facetMode.name === 'Grade'
              ? "join(['Grade ',if(datum.value == '0', 'K', datum.value ), ], '')"
              : 'split(slice(datum.value, 2, datum.value.length), " ")',
          labelLimit: 150,
          labelSeparation: 0, // Set the spacing between lines in pixels
        },
        spacing: 18,
        sort: 'ascending',
      },

      color: {
        field: `tag_color`,
        type: 'nominal',
        legend: null,
        scale: null,
      },

      x: {
        field: `scores.${scoreMode.value.key}`,
        title: scoreMode.value.name === 'Percentile' ? `${scoreMode.value.name} Score` : `${scoreMode.value.name}`,
        bin: {
          step: getBinSize(scoreMode.value.name, props.taskId),
          extent: [getRangeLow(scoreMode.value.name, props.taskId), getRangeHigh(scoreMode.value.name, props.taskId)],
        },
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
          labelBaseline: 'right',
          titleFontSize: 14,
          labelLimit: 180,
          labelPadding: 8,
          labelFontSize: 14,
          labelColor: 'navy',
          labelFontStyle: '',
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
});

const draw = async () => {
  let chartSpecDist = distributionChartFacet.value;
  await embed(`#roar-distribution-chart-${props.taskId}`, chartSpecDist);
};

// Update Distribution Graph on external facetMode change
watch(
  () => props.facetMode,
  () => {
    draw();
  },
);

// Update Distribution Graph on computedRuns recalculation
watch(
  () => computedRuns,
  () => {
    draw();
  },
);

// Update Distribution Graph on internal scoreMode change
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
  align-items: center;
  height: 100%;
}
</style>
