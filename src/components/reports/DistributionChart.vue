<template>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import embed from 'vega-embed';
import { runPageFetcher } from '@/helpers/query/runs';
import { distByGrade } from './chartSpecs.js';

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

// const computedScores = computed(() => {
//   if (scores.value === undefined) return [];
//   return scores.value.map(({ user, scores }) => {

//   })
// })

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
  if (props.graphType === 'distByGrade') chartSpec = distByGrade(props.taskId, scores, scoreField);
  // Other chart types can be added via this if/then pattern

  await embed(`#roar-dist-chart-${props.taskId}`, chartSpec);
};

watch(isLoading, (val) => {
  if (!val && props.initialized) {
    draw();
  }
});
</script>
