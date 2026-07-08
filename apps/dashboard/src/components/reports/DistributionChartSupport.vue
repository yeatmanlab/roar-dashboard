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
import { computed, ref, watch } from 'vue';
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
  facets: {
    // Per-task facet aggregation from `getScoreFacets` (supportLevelByGrade /
    // supportLevelBySchool). Null while the query is loading.
    type: Object,
    required: false,
    default: null,
  },
  facetMode: {
    type: Object,
    required: true,
    default() {
      return { name: 'Grade', key: 'grade' };
    },
  },
});

// Leading-zero trim matches the prior client behavior (e.g. "01" → "1").
const trimGrade = (grade) => String(grade ?? '').replace(/^0+(?=\D|\d)/, '');

// Map a backend support-level facet entry to the chart's intermediate shape.
// `totalStudents` is the sum of the three classified levels — the Percent-mode
// denominator — and intentionally excludes optional/null levels, matching the
// prior client aggregation (which only counted runs with a classified level).
const toBreakdownRow = (category, entry) => ({
  category,
  support_levels: [entry.needsExtraSupport.count, entry.developingSkill.count, entry.achievedSkill.count],
  totalStudents: entry.needsExtraSupport.count + entry.developingSkill.count + entry.achievedSkill.count,
});

const gradeSupportBreakdown = computed(() =>
  (props.facets?.supportLevelByGrade ?? []).map((entry) => toBreakdownRow(trimGrade(entry.grade), entry)),
);

// Empty at non-district scope — the backend returns empty school arrays there
// (the school-facet toggle is district-only).
const schoolSupportBreakdown = computed(() =>
  (props.facets?.supportLevelBySchool ?? []).map((entry) =>
    toBreakdownRow(entry.schoolName ?? 'Unknown school', entry),
  ),
);

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
  const gradeCounts = gradeSupportBreakdown.value;
  const schoolCounts = schoolSupportBreakdown.value;
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
      text: `${tasksDictionary.value[props.taskId]?.nameSimple ?? props.taskId}`,
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

watch(
  [() => distributionBySupport.value, () => props.facetMode, () => props.facets],
  () => {
    draw();
  },
  { deep: true, immediate: true },
);
</script>

<style lang="scss">
.view-by-wrapper {
  display: flex;
  flex-direction: column;
  align-items: space-around;
  justify-content: center;
}
</style>
