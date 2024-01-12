<template>
  <div v-if="orgType === 'district'" class="mode-select-wrapper mt-2">
    <div class="flex uppercase text-xs font-light">view by</div>
    <PvSelectButton
      v-model="facetMode"
      class="flex flex-row"
      :options="facetModes"
      option-label="name"
      @change="handleFacetModeChange"
    />
  </div>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
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

const facetMode = ref({ name: 'Grade', key: 'grade' });
const facetModes = [
  { name: 'Grade', key: 'grade' },
  { name: 'School', key: 'schoolName' },
];

const handleFacetModeChange = () => {
  draw();
};

const distByGrade = (taskId, runs) => {
  return {
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[taskId].name}`,
      subtitle: 'Distribution of Percentile By Grade',
      anchor: 'middle',
      fontSize: 18,
    },
    data: { values: runs.filter((run) => run.user && run.user.grade !== undefined) },
    mark: 'bar',
    height: 50,
    width: 360,
    encoding: {
      row: {
        field: `user.${facetMode.value.key}`,
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
            facetMode.value.name === 'Grade'
              ? "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')"
              : '',
          labelLimit: 150,
          labelSeparation: 5, // Set the spacing between lines in pixels
        },
        spacing: 10,
        sort: 'ascending',
      },

      color: {
        field: 'scores.stdPercentile',
        type: 'quantitative',
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
        { field: 'scores.stdPercentile', title: 'Percentile', type: 'quantitative', format: `.0f` },
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
  let chartSpecDist = distByGrade(props.taskId, props.runs);
  await embed(`#roar-dist-chart-${props.taskId}`, chartSpecDist);
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>

<style lang="scss">
.mode-select-wrapper {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.distribution-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  height: 100%;
}
</style>
