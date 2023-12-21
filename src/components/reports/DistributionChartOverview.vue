<template>
  <div :id="`roar-dist-chart-overview-${taskId}`"></div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
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
  runs: {
    type: Array,
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
    required: false,
    default: 'distByGrade',
  },
  mode: {
    type: String,
    required: false,
    default: 'Count',
  },
});

const supportLevelsOverview = computed(() => {
  if (!props.runs) return [];
  let values = {};
  for (const { scores } of props.runs) {
    const support_level = scores.support_level;
    if (support_level in values) {
      values[support_level] += 1;
    } else {
      values[support_level] = 1;
    }
  }

  // transform dictionary into datatype readable to vega
  return Object.entries(values)
    .filter(([support_level]) => support_level !== 'null')
    .map(([support_level, count]) => ({ category: support_level, value: count }));
});

const overviewDistributionChart = (taskId) => {
  const spec = {
    mark: 'bar',
    height: 170,
    width: 170,
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[taskId].name}`,
      subtitle: `Count by Support Level`,
      anchor: 'middle',
      fontSize: 16,
    },
    data: {
      values: supportLevelsOverview.value,
    },
    encoding: {
      y: {
        field: 'value',
        title: `Count of Students`,
        type: 'quantitative',
        spacing: 1,
        fontSize: 14,
        axis: {
          labelFontSize: 12,
          titleFontSize: 12,
        },
      },
      x: {
        field: 'category',
        type: 'ordinal',
        title: 'Support Level',
        spacing: 1,
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
        legend: null,
        axis: {
          labelAngle: -30,
          labelAlign: 'right',
          titleFontSize: 12,
          labelFontSize: 12,
        },
      },
      color: {
        field: 'category',
        title: 'Support Level',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
        scale: { range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'] },
        legend: null,
      },
      tooltip: [
        { title: 'Count', field: 'value', type: 'quantitative', format: '.0f' },
        { field: 'category', title: 'Support Level' },
      ],
    },
  };
  return spec;
};

const draw = async () => {
  let chartSpecSupport = overviewDistributionChart(props.taskId, props.runs, props.mode);
  await embed(`#roar-dist-chart-overview-${props.taskId}`, chartSpecSupport);
};

onMounted(() => {
  if (props.taskId !== 'letter') {
    draw();
  }
});
</script>
