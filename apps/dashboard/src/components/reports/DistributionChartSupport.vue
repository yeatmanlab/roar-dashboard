<template>
  <div :id="`roar-distribution-chart-support-${taskId}`"></div>
  <div class="my-2 view-by-wrapper" data-html2canvas-ignore="true">
    <div class="flex text-xs font-light uppercase">view support levels by</div>
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
import PvSelectButton from 'primevue/selectbutton';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery';
import { SCORE_SUPPORT_LEVEL_COLORS } from '@/constants/scores';

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

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

const districtGradeSupportBreakdown = computed(() => {
  // For district-level aggregation: { above/some/below: { grades: { "1": n, ... } } }
  if (props.orgType === 'district') {
    const supportLevelIndexMap = { below: 0, some: 1, above: 2 }; // matches chart order
    const gradeMap = new Map(); // key = grade

    ['below', 'some', 'above'].forEach((level) => {
      const grades = props?.runs?.[level]?.grades ?? {};
      Object.entries(grades).forEach(([grade, count]) => {
        if (!gradeMap.has(grade)) {
          gradeMap.set(grade, { category: grade, support_levels: [0, 0, 0], totalStudents: 0 });
        }
        const row = gradeMap.get(grade);
        row.support_levels[supportLevelIndexMap[level]] += count;
        row.totalStudents += count;
      });
    });

    return Array.from(gradeMap.values());
  }

  // For school- or class-level aggregation
  const gradeCounts = [];
  for (const run of props.runs) {
    let gradeCounter = gradeCounts.find((g) => g.category === run?.user?.grade);
    if (!gradeCounter) {
      gradeCounter = { category: run?.user?.grade, support_levels: [0, 0, 0], totalStudents: 0 };
      gradeCounts.push(gradeCounter);
    }

    const supportLevel = run?.scores?.support_level;
    if (supportLevel === 'Needs Extra Support') gradeCounter.support_levels[0]++;
    else if (supportLevel === 'Developing Skill') gradeCounter.support_levels[1]++;
    else if (supportLevel === 'Achieved Skill') gradeCounter.support_levels[2]++;
    else return; // skip null or undefined support levels

    gradeCounter.totalStudents++;
  }

  return gradeCounts;
});

const districtSchoolSupportBreakdown = computed(() => {
  // For district-level aggregation: { above/some/below: { schools: { name: n, ... } } }
  if (props.orgType === 'district') {
    const supportLevelIndexMap = { below: 0, some: 1, above: 2 };
    const schoolMap = new Map(); // key = school name

    ['below', 'some', 'above'].forEach((level) => {
      const schools = props?.runs?.[level]?.schools ?? {};
      Object.values(schools).forEach(({ name, count }) => {
        const key = name ?? 'Unknown school';
        if (!schoolMap.has(key)) {
          schoolMap.set(key, { category: key, support_levels: [0, 0, 0], totalStudents: 0 });
        }
        const row = schoolMap.get(key);
        row.support_levels[supportLevelIndexMap[level]] += count;
        row.totalStudents += count;
      });
    });

    return Array.from(schoolMap.values());
  }

  // For non-district orgs (class, school, group, etc.)
  const schoolCounts = [];
  for (const run of props.runs) {
    const schoolName = run?.user?.schoolName ?? 'Unknown school';
    let schoolCounter = schoolCounts.find((s) => s.category === schoolName);
    if (!schoolCounter) {
      schoolCounter = { category: schoolName, support_levels: [0, 0, 0], totalStudents: 0 };
      schoolCounts.push(schoolCounter);
    }

    const supportLevel = run?.scores?.support_level;
    if (supportLevel === 'Needs Extra Support') schoolCounter.support_levels[0]++;
    else if (supportLevel === 'Developing Skill') schoolCounter.support_levels[1]++;
    else if (supportLevel === 'Achieved Skill') schoolCounter.support_levels[2]++;
    else return; // skip null or undefined support levels

    schoolCounter.totalStudents++;
  }

  return schoolCounts;
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
  const gradeCounts = districtGradeSupportBreakdown.value;
  const schoolCounts = districtSchoolSupportBreakdown.value;
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
      text: `${tasksDictionary.value[props.taskId]?.publicName ?? props.taskId}`,
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
        scale: {
          range: [SCORE_SUPPORT_LEVEL_COLORS.BELOW, SCORE_SUPPORT_LEVEL_COLORS.SOME, SCORE_SUPPORT_LEVEL_COLORS.ABOVE],
        },
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

const draw = async () => {
  const chartSpecSupport = distributionBySupport.value;

  // Don't draw if chart spec is empty (still loading)
  if (!chartSpecSupport || Object.keys(chartSpecSupport).length === 0) {
    return;
  }

  await embed(`#roar-distribution-chart-support-${props.taskId}`, chartSpecSupport);
};

// Watch for changes to the computed chart specification (includes tasksDictionary loading)
watch(
  () => distributionBySupport.value,
  () => {
    draw();
  },
  { deep: true },
);

watch(
  () => props.facetMode,
  () => {
    draw();
  },
);

// Watch runs for data changes
watch(
  () => props.runs,
  () => {
    draw();
  },
  { deep: true },
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
