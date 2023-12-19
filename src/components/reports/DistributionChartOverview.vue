<template>
    <div :id="`roar-dist-chart-overview-${taskId}`"></div>
</template>
  
<script setup>
import { computed, onMounted } from 'vue';
import embed from 'vega-embed';
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
    scores: {
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
        default: 'count',
    },
});

const supportLevelsOverview = computed(() => {
    if (!props.scores) return []
    let values = {};
    for (const score of props.scores) {
        const { support_level } = getSupportLevel(score?.scores?.[(parseInt(score?.user?.grade) >= 6 ? scoreFieldAboveSixth.value : scoreFieldBelowSixth.value)])
        if (support_level in values) {
            values[support_level] += 1;
        } else {
            values[support_level] = 1;
        }
    }

    // transform dictionary into datatype readable to vega
    return Object.entries(values).map(([support_level, count]) => ({ category: support_level, value: count }));
})

const overviewDistributionChart = (taskId, scores, mode = 'count') => {
    const spec = {
        mark: 'bar',
        height: 200,
        width: 200,
        title: {
            text: `ROAR-${taskId.toUpperCase()} Support Levels`,
            anchor: 'middle',
            fontSize: 18,
            description: 'Support level Count',
        },
        data: {
            values: supportLevelsOverview.value,
        },
        encoding: {
            y: {
                field: 'value',
                title: `${mode}`,
                type: 'quantitative',
                spacing: 1,
            },
            x: {
                field: 'category',
                type: 'ordinal',
                title: 'Support Level',
                spacing: 1,
                sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                legend: null,
            },
            color: {
                field: 'category',
                title: 'Support Level',
                sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
                scale: { range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'] },
                legend: null,
            },
            tooltip: [{ field: 'value', type: 'quantitative', format: '.0f' }, { field: 'category' }]
        },
    };
    return spec;
};

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
    let chartSpecSupport = overviewDistributionChart(props.taskId, props.scores, props.mode);
    await embed(`#roar-dist-chart-overview-${props.taskId}`, chartSpecSupport);
    // Other chart types can be added via this if/then pattern

};

onMounted(() => {
    draw(); // Call your function when the component is mounted
});
</script>
  