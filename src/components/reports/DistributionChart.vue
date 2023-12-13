<template>
  <div :id="`roar-dist-chart-support`"></div>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import _get from 'lodash/get';
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import embed from 'vega-embed';
import { runPageFetcher } from '@/helpers/query/runs';
import { distByGrade, distBySupportLevel } from './chartSpecs.js';
import { getSupportLevel } from '@/helpers/reports';

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
  graphType: {
    type: String,
    required: true,
    default: 'distByGrade',
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
      select: 'scores.computed.composite',
    }),
  keepPreviousData: true,
  enabled: props.initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const computedScores = computed(() => {
  if (scores.value === undefined) return [];
  return scores.value.map(({ user, scores }) => {
    const percentScore = _get(scores, scoreField.value);
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

const draw = async () => {
  let chartSpec;
  let chartSpec2;
  if (props.graphType === 'distByGrade') chartSpec = distByGrade(props.taskId, computedScores, scoreField);
  else if (props.graphType === 'distBySupportLevel') {
    if(props.taskId === "swr") {
    chartSpec2 = distBySupportLevel(props.taskId, computedScores, scoreField);
    await embed(`#roar-dist-chart-support`, chartSpec2);
    }
  }
  // Other chart types can be added via this if/then pattern

  await embed(`#roar-dist-chart-${props.taskId}`, chartSpec);
};

watch(isLoading, (val) => {
  if (!val && props.initialized) {
    draw();
  }
});
</script>
