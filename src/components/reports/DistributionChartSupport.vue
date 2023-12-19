<template>
  <div :id="`roar-dist-chart-support-${taskId}`"></div>
</template>

<script setup>
import _get from 'lodash/get';
import { computed, onMounted } from 'vue';
import embed from 'vega-embed';
import { getSupportLevel, taskDisplayNames } from '@/helpers/reports';

function returnGradeCount(scores) {
  // gradecount should be an obj of {{grade:{} count}}
  const gradeCount = [
    { grade: 'Pre-K', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: 'T-K', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: 'Kindergarten', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '1', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '2', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '3', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '4', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '5', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '6', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '7', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '8', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '9', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '10', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '11', support_levels: [0, 0, 0], totalStudents: 0 },
    { grade: '12', support_levels: [0, 0, 0], totalStudents: 0 },
  ];
  for (const score of scores.value) {
    let gradeCounter = gradeCount.find((grade) => grade.grade === score?.user?.grade?.toString());
    if (gradeCounter) {
      if (score?.scores?.support_level === 'Needs Extra Support' && gradeCounter) {
        gradeCounter.support_levels[0]++;
        gradeCounter.totalStudents++;
      } else if (score?.scores?.support_level === 'Needs Some Support' && gradeCounter) {
        gradeCounter.support_levels[1]++;
        gradeCounter.totalStudents++;
      } else if (score?.scores?.support_level === 'At or Above Average' && gradeCounter) {
        gradeCounter.support_levels[2]++;
        gradeCounter.totalStudents++;
      } else {
        // score not counted (support level null)
      }
    }
  }

  return gradeCount;
}

function returnValueByIndex(index, grade, mode) {
  if (index >= 0 && index <= 2) {
    // 0 => needs extra support
    // 1 => needs some support
    // 2 => at or above average
    const valsByIndex = [
      { group: 'Needs Extra Support' },
      { group: 'Needs Some Support' },
      { group: 'At or Above Average' },
    ];
    if (mode === 'percentage') {
      return {
        category: grade.grade,
        group: valsByIndex[index].group,
        value: grade?.support_levels[index] / grade.totalStudents,
      };
    }
    if (mode === 'count') {
      return {
        category: grade.grade,
        group: valsByIndex[index].group,
        value: grade?.support_levels[index],
      };
    }
    throw new Error('Mode not Supported');
  } else {
    throw new Error('Index out of range');
  }
}

function returnSupportLevelValues(scores, mode) {
  const gradeCounts = returnGradeCount(scores);
  const values = [];
  // generates values for bar chart
  for (const grade of gradeCounts) {
    if (grade?.totalStudents > 0) {
      for (let i = 0; i < grade?.support_levels.length; i++) {
        let value = returnValueByIndex(i, grade, mode);
        values.push(value);
      }
    }
  }
  return values;
}

const distBySupport = (taskId, scores, mode = 'percentage') => {
  return {
    mark: 'bar',
    height: 300,
    width: 330,
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[taskId].name} Support Level Distribution`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: returnSupportLevelValues(scores, mode),
    },
    encoding: {
      x: {
        field: 'value',
        title: `${mode}`,
        type: 'quantitative',
        spacing: 1,
        format: ".0%",
      },
      y: {
        field: 'category',
        type: 'ordinal',
        title: 'By Grade',
        spacing: 1,
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        axis: {
          labelAngle: 0,
          labelAlign: 'center',
        },
      },
      yOffset: {
        field: 'group',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
      },
      color: {
        field: 'group',
        title: 'Support Level',
        sort: ['Needs Extra Support', 'Needs Some Support', 'At or Above Average'],
        scale: { range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'] },
      },
      tooltip: [{ field: 'value', type: 'quantitative', format: '.0%' }, { field: 'group' }],
    },
  };
};

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
  runs: {
    type: Array,
    required: true,
  }
});

const computedRuns = computed(() => {
  if (props.runs === undefined) return [];
  return props.runs.map(({ scores, user }) => {
    let percentScore;
    if (user?.grade >= 6) {
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
  let chartSpecSupport = distBySupport(props.taskId, computedRuns, props.mode);
  await embed(`#roar-dist-chart-support-${props.taskId}`, chartSpecSupport);
  // Other chart types can be added via this if/then pattern

};

// watch(props.scores, (val) => {
//   if (val && props.initialized) {
//     draw();
//   }
// });

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>
