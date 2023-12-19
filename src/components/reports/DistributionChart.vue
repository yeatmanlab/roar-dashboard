<template>
  <div :id="`roar-dist-chart-support-${taskId}`"></div>
  <div :id="`roar-dist-chart-${taskId}`"></div>
</template>

<script setup>
import _get from 'lodash/get';
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import embed from 'vega-embed';
import { runPageFetcher } from '@/helpers/query/runs';
import { distByGrade, distBySupport } from './chartSpecs.js';
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
  mode: {
    type: String,
    required: false,
    default: 'percentage',
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
      scoreKey: 'scores.computed.composite'
    }),
  keepPreviousData: true,
  enabled: props.initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const computedScores = computed(() => {
  if (scores.value === undefined) return [];
  return scores.value.map(({ user, scores }) => {
    let percentScore;
    if (user.grade >= 6) {
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
  if (props.graphType === 'distByGrade') {
    let chartSpecDist = distByGrade(props.taskId, computedScores, scoreFieldBelowSixth, scoreFieldAboveSixth);
    await embed(`#roar-dist-chart-${props.taskId}`, chartSpecDist);
  }
  else if (props.graphType === 'distBySupport') {
    let chartSpecSupport = distBySupport(props.taskId, computedScores, props.mode);
    await embed(`#roar-dist-chart-support-${props.taskId}`, chartSpecSupport);
  }
  // Other chart types can be added via this if/then pattern

};

watch(isLoading, (val) => {
  if (!val && props.initialized) {
    draw();
  }
});
</script>
