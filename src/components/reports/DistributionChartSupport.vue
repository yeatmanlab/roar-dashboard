<template>
  <div :id="`roar-distribution-chart-support-${taskId}`"></div>
  <div class="view-by-wrapper my-2" data-html2canvas-ignore="true">
    <div class="flex uppercase text-xs font-light">view support levels by</div>
    <PvSelectButton
      v-model="xMode"
      class="flex flex-row my-2 select-button"
      :allow-empty="false"
      :options="xModes"
      option-label="name"
      @change="handleXModeChange"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import embed from 'vega-embed';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const returnGradeCount = computed(() => {
  const gradeCount = [];
  for (const run of props.runs) {
    let gradeCounter = gradeCount.find((grade) => grade.category === run?.user?.grade);
    if (!gradeCounter) {
      gradeCounter = { category: run?.user?.grade, support_levels: [0, 0, 0], totalStudents: 0 };
      gradeCount.push(gradeCounter);
    }
    if (run?.scores?.support_level === 'Needs Extra Support') {
      gradeCounter.support_levels[0]++;
      gradeCounter.totalStudents++;
    } else if (run?.scores?.support_level === 'Developing Skill') {
      gradeCounter.support_levels[1]++;
      gradeCounter.totalStudents++;
    } else if (run?.scores?.support_level === 'Achieved Skill') {
      gradeCounter.support_levels[2]++;
      gradeCounter.totalStudents++;
    } else {
      // score not counted (support level null)
    }
  }

  return gradeCount;
});

const returnSchoolCount = computed(() => {
  const schoolCount = [];
  for (const score of props.runs) {
    let schoolCounter = schoolCount.find((school) => school.category === score?.user?.schoolName);
    if (!schoolCounter) {
      schoolCounter = { category: score?.user?.schoolName, support_levels: [0, 0, 0], totalStudents: 0 };
      schoolCount.push(schoolCounter);
    }
    if (score?.scores?.support_level === 'Needs Extra Support') {
      schoolCounter.support_levels[0]++;
      schoolCounter.totalStudents++;
    } else if (score?.scores?.support_level === 'Developing Skill') {
      schoolCounter.support_levels[1]++;
      schoolCounter.totalStudents++;
    } else if (score?.scores?.support_level === 'Achieved Skill') {
      schoolCounter.support_levels[2]++;
      schoolCounter.totalStudents++;
    } else {
      // score not counted (support level null)
    }
  }

  return schoolCount;
});

const xMode = ref({ name: 'Percent' });
const xModes = [{ name: 'Percent' }, { name: 'Count' }];

const handleXModeChange = () => {
  draw();
};

function returnValueByIndex(index, xMode, grade) {
  if (index >= 0 && index <= 2) {
    // 0 => needs extra support
    // 1 => needs some support
    // 2 => at or above average
    const valsByIndex = [{ group: 'Needs Extra Support' }, { group: 'Developing Skill' }, { group: 'Achieved Skill' }];
    if (xMode.name === 'Percent') {
      return {
        category: grade.category,
        group: valsByIndex[index].group,
        value: grade?.support_levels[index] / grade.totalStudents,
      };
    }
    if (xMode.name === 'Count') {
      return {
        category: grade.category,
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
  const gradeCounts = returnGradeCount.value;
  const schoolCounts = returnSchoolCount.value;
  const counts = props.facetMode.name === 'Grade' ? gradeCounts : schoolCounts;
  const values = [];
  // generates values for bar chart
  for (const count of counts) {
    if (count?.totalStudents > 0) {
      for (let i = 0; i < count?.support_levels.length; i++) {
        let value = returnValueByIndex(i, xMode.value, count);
        values.push(value);
      }
    }
  }
  return values;
});

const graphHeight = computed(() => {
  return returnSupportLevelValues.value.length * 23.5;
});

const distributionBySupport = computed(() => {
  if (isLoadingTasksDictionary.value) return {};
  return {
    mark: 'bar',
    height: graphHeight.value,
    width: 350,
    background: null,
    title: {
      text: `${tasksDictionary.value[props.taskId].publicName ?? props.taskId}`,
      subtitle: `Support Level Distribution By ${props.facetMode.name}`,
      anchor: 'middle',
      fontSize: 18,
    },
    data: {
      values: returnSupportLevelValues.value,
    },
    encoding: {
      x: {
        field: 'value',
        title: `${xMode.value.name} of Students`,
        type: 'quantitative',
        spacing: 1,
        axis: {
          format: `${xMode.value.name === 'Percent' ? '.0%' : '.0f'}`,
          titleFontSize: 14,
          labelFontSize: 14,
          tickCount: 5,
          tickMinStep: 1,
        },
      },

      y: {
        field: 'category',
        type: 'ordinal',
        title: '',
        spacing: 1,
        sort:
          props.facetMode.name === 'Grade'
            ? [
                'Kindergarten',
                1,
                '1',
                2,
                '2',
                3,
                '3',
                4,
                '4',
                5,
                '5',
                6,
                '6',
                7,
                '7',
                8,
                '8',
                9,
                '9',
                10,
                '10',
                11,
                '11',
                12,
                '12',
              ]
            : 'ascending',
        axis: {
          labelBaseline: 'line-bottom',
          titleFontSize: 14,
          labelLimit: 180,
          labelPadding: 8,
          labelFontSize: 14,
          labelColor: 'navy',
          labelFontStyle: '',
          transform: [{ calculate: "split(datum.address, ' ')", as: 'address' }],
          labelExpr:
            props.facetMode.name === 'Grade'
              ? "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')"
              : 'split(slice(datum.value, 2, datum.value.length), " ")',
        },
      },
      yOffset: {
        field: 'group',
        sort: ['Needs Extra Support', 'Developing Skill', 'Achieved Skill'],
      },
      color: {
        field: 'group',
        title: 'Support Level',
        sort: ['Needs Extra Support', 'Developing Skill', 'Achieved Skill'],
        scale: { range: ['rgb(201, 61, 130)', 'rgb(237, 192, 55)', 'green'] },
        labelFontSize: 16,
        legend: {
          orient: 'bottom',
          labelFontSize: '12',
        },
      },
      tooltip: [
        {
          title: `${xMode.value.name === 'Percent' ? 'Percent' : 'Count'}`,
          field: 'value',
          type: 'quantitative',
          format: `${xMode.value.name === 'Percent' ? '.0%' : '.0f'}`,
        },
        { field: 'group', title: 'Support Level' },
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
  facetMode: {
    type: Object,
    required: true,
    default() {
      return { name: 'Grade', key: 'grade' };
    },
  },
});

const draw = async () => {
  let chartSpecSupport = distributionBySupport.value;
  await embed(`#roar-distribution-chart-support-${props.taskId}`, chartSpecSupport);
};

watch(
  () => props.facetMode,
  () => {
    draw();
  },
);

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>

<style lang="scss">
.view-by-wrapper {
  display: flex;
  flex-direction: column;
  align-items: space-around;
  justify-content: center;
}
</style>
