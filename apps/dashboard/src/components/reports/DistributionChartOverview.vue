<template>
  <div :id="`roar-dist-chart-overview-${taskId}`"></div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import embed from 'vega-embed';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

const props = defineProps({
  initialized: {
    type: Boolean,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
  // Backend-aggregated support-level counts from the score-overview endpoint,
  // shaped `{ needsExtraSupport: { count }, developingSkill: { count }, achievedSkill: { count } }`.
  // When provided, it is the chart's data source and `runs` is ignored — this is
  // the server-computed replacement for the client-side `runs` aggregation.
  supportLevelCounts: {
    type: Object,
    required: false,
    default: undefined,
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
    required: false,
    default: 'distByGrade',
  },
  mode: {
    type: String,
    required: false,
    default: 'Count',
  },
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

// Maps the score-overview endpoint's support-level keys to the chart's display
// categories (which match the color-scale domain below).
const BACKEND_SUPPORT_LEVEL_LABELS = {
  needsExtraSupport: 'Needs Extra Support',
  developingSkill: 'Developing Skill',
  achievedSkill: 'Achieved Skill',
};

const supportLevelsOverview = computed(() => {
  // Server-aggregated counts from the score-overview endpoint, shaped
  // `{ needsExtraSupport: { count }, developingSkill: { count }, achievedSkill: { count } }`.
  if (!props.supportLevelCounts) return [];

  return Object.entries(BACKEND_SUPPORT_LEVEL_LABELS).map(([key, category]) => ({
    category,
    value: props.supportLevelCounts[key]?.count ?? 0,
  }));
});

const overviewDistributionChart = computed(() => {
  if (isLoadingTasksDictionary.value) return {};

  return {
    mark: 'arc',
    height: 190,
    width: 190,
    spacing: 10,
    background: null,
    title: {
      text: `${tasksDictionary.value[props.taskId]?.nameSimple ?? props.taskId}`,
      subtitle: `Count by Support Level`,
      anchor: 'middle',
      fontSize: 20,
      offset: 15,
    },
    data: {
      values: supportLevelsOverview.value,
    },
    encoding: {
      theta: {
        field: 'value',
        title: `Count of Students`,
        type: 'quantitative',
        stack: true,
        axis: null,
      },
      color: {
        field: 'category',
        title: 'Support Level',
        scale: {
          domain: ['Needs Extra Support', 'Developing Skill', 'Achieved Skill'],
          range: [SCORE_SUPPORT_LEVEL_COLORS.BELOW, SCORE_SUPPORT_LEVEL_COLORS.SOME, SCORE_SUPPORT_LEVEL_COLORS.ABOVE],
        },
        legend: false,
      },
      tooltip: [
        { title: 'Count', field: 'value', type: 'quantitative', format: '.0f' },
        { field: 'category', title: 'Support Level' },
      ],
    },
    config: {
      arc: { innerRadius: 0 },
    },
  };
});

const draw = async () => {
  const chartSpecSupport = overviewDistributionChart.value;

  // Don't draw if chart spec is empty (still loading)
  if (!chartSpecSupport || Object.keys(chartSpecSupport).length === 0) {
    return;
  }

  await embed(`#roar-dist-chart-overview-${props.taskId}`, chartSpecSupport);
};

watch(
  [() => overviewDistributionChart.value, () => props.runs, () => props.supportLevelCounts, () => props.orgType],
  () => {
    if (props.taskId !== 'letter') {
      draw();
    }
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  if (props.taskId !== 'letter') {
    draw();
  }
});
</script>
