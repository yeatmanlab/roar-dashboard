<template>
  <!-- <PvSelectButton></PvSelectButton> -->
  <div :id="`roar-dist-chart-support-${taskId}`"></div>
  <div class="mode-select-wrapper mt-2">
    <div class="flex uppercase text-xs font-light">view by</div>
    <PvSelectButton
      v-model="xMode"
      class="flex flex-row"
      :options="xModes"
      option-label="name"
      @change="handleXModeChange"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import embed from 'vega-embed';
import { taskDisplayNames } from '@/helpers/reports';

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
  for (const score of scores) {
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

const xMode = ref({ name: 'Percentage' });
const xModes = [{ name: 'Percentage' }, { name: 'Count' }];

const handleXModeChange = () => {
  draw();
};

function returnValueByIndex(index, xMode, grade) {
  if (index >= 0 && index <= 2) {
    // 0 => needs extra support
    // 1 => needs some support
    // 2 => at or above average
    const valsByIndex = [
      { group: 'Needs Extra Support' },
      { group: 'Needs Some Support' },
      { group: 'At or Above Average' },
    ];
    if (xMode.name === 'Percentage') {
      return {
        category: grade.grade,
        group: valsByIndex[index].group,
        value: grade?.support_levels[index] / grade.totalStudents,
      };
    }
    if (xMode.name === 'Count') {
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

const returnSupportLevelValues = computed(() => {
  const gradeCounts = returnGradeCount(props.runs);
  const values = [];
  // generates values for bar chart
  for (const grade of gradeCounts) {
    if (grade?.totalStudents > 0) {
      for (let i = 0; i < grade?.support_levels.length; i++) {
        let value = returnValueByIndex(i, xMode.value, grade);
        values.push(value);
      }
    }
  }
  return values;
});

const distBySupport = computed(() => {
  return {
    mark: 'bar',
    height: 300,
    width: 330,
    background: null,
    title: {
      text: `ROAR-${taskDisplayNames[props.taskId].name} Support Level Distribution`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: returnSupportLevelValues.value,
    },
    encoding: {
      x: {
        field: 'value',
        title: `${xMode.value.name}`,
        type: 'quantitative',
        spacing: 1,
        format: '.0%',
      },
      y: {
        field: 'category',
        type: 'ordinal',
        title: 'By Grade',
        spacing: 1,
        sort: ['Kindergarten', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        axis: {
          labelAngle: 0,
          labelAlign: 'right',
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
      tooltip: [
        { field: 'value', type: 'quantitative', format: `${xMode.value.name === 'Percentage' ? '.0%' : '.0f'}` },
        { field: 'group' },
      ],
    },
  };
});

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
  runs: {
    type: Array,
    required: true,
  },
});

const draw = async () => {
  let chartSpecSupport = distBySupport.value;
  await embed(`#roar-dist-chart-support-${props.taskId}`, chartSpecSupport);
  // Other chart types can be added via this if/then pattern
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>

<style lang="scss">
.mode-select-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
</style>
