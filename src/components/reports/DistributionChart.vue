<template>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import embed from 'vega-embed';
import _camelCase from 'lodash/camelCase';
import { runPageFetcher } from '@/helpers/query/runs';

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
});

const { data: scores, isLoading } = useQuery({
  queryKey: ['scores', props.taskId, props.orgType, props.orgId, props.administrationId],
  queryFn: () =>
    runPageFetcher({
      administrationId: props.administrationId,
      orgType: props.orgType,
      orgId: props.orgId,
      taskId: props.taskId,
      pageLimit: ref(0),
      page: ref(0),
      paginate: false,
      select: ['scores.computed.composite'],
    }),
  keepPreviousData: true,
  enabled: props.initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const scoreField = computed(() => {
  if (props.taskId === 'swr') {
    return 'wjPercentile';
  } else if (props.taskId === 'sre') {
    return 'tosrecPercentile';
  } else if (props.taskId === 'pa') {
    return 'percentile';
  }

  return 'percentile';
});

const graphColorType = {
  mediumPink: '#cc79a7',
  mediumYellow: '#f0e442',
  mediumBlue: '#0072b2',
  lightBlueGreen: '#44aa99',
  darkPurple: '#342288',
  black: '#000000',
};

const draw = async () => {
  const distributionByGrade = {
    description: 'ROAR Score Distribution by Grade Level',
    title: { text: `${props.taskId.toUpperCase()} Score Distribution`, anchor: 'middle', fontSize: 18 },
    config: { view: { stroke: graphColorType.black, strokeWidth: 1 } },

    data: { values: scores.value },

    mark: 'bar',
    height: 50,
    width: 600,

    encoding: {
      facet: {
        field: 'user.grade',
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
        field: 'user.grade',
        type: 'ordinal',
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        legend: null,
      },

      x: {
        field: `scores.${scoreField.value}`,
        title: _camelCase(scoreField.value),
        bin: { step: 5, extent: [0, 100] },
      },

      y: {
        aggregate: 'count',
        title: 'count',
        axis: { orient: 'right' },
      },
    },
  };

  await embed(`#roar-dist-chart-${props.taskId}`, distributionByGrade);
};

watch(isLoading, (val) => {
  if (!val && props.initialized) {
    draw();
  }
});
</script>
