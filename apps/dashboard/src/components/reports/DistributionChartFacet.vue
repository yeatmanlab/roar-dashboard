<template>
  <div class="distribution-wrapper">
    <div :id="`roar-distribution-chart-${taskId}`"></div>
    <div
      v-if="minGradeByRuns < 6"
      class="view-by-wrapper my-2 justify-content-center align-items-center pl-8 ml-4"
      data-html2canvas-ignore="true"
    >
      <div class="flex uppercase text-xs font-light justify-content-center align-items-center">view scores by</div>
      <PvSelectButton
        v-model="scoreMode"
        :allow-empty="false"
        class="flex flex-row my-2 select-button"
        :options="scoreModes"
        option-label="name"
        @change="handleModeChange"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import embed from 'vega-embed';
import PvSelectButton from 'primevue/selectbutton';
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
  facetMode: {
    type: Object,
    required: true,
    default() {
      return { name: 'Grade', key: 'grade' };
    },
  },
  runs: {
    type: Array,
    required: true,
  },
  minGradeByRuns: {
    type: Number,
    required: true,
  },
  taskScoringVersions: {
    type: Object,
    required: true,
  },
});

const makeRunsFromBins = ({ binsObj, facet, scoreKey }) => {
  const rows = [];
  if (!binsObj || typeof binsObj !== 'object') return rows;

  for (const [binLabel, payload] of Object.entries(binsObj)) {
    const [a, b] = String(binLabel).split('-').map(Number);
    const value = Number.isFinite(a) && Number.isFinite(b) ? (a + b) / 2 : NaN;
    if (!Number.isFinite(value)) continue;

    const normalizeGrade = (gradeStr) => {
      let grade = String(gradeStr).replace(/^0+(?=\D|\d)/, '');
      if (['K', 'kg', 'Kindergarten'].includes(grade)) {
        return 'Kindergarten';
      }
      return grade;
    };

    if (facet === 'grade') {
      const grades = payload?.grades ?? {};
      for (const [gradeKey, countRaw] of Object.entries(grades)) {
        const count = Number(countRaw) || 0;
        const normalizedGrade = normalizeGrade(gradeKey);
        for (let i = 0; i < count; i++) {
          rows.push({
            grade: normalizedGrade,
            scores: { [scoreKey]: value },
          });
        }
      }
    } else {
      const schools = payload?.schools ?? {};
      for (const school of Object.values(schools)) {
        const name = school?.name ?? 'Unknown school';
        const grades = school?.grades ?? {};

        // If grade breakdown is available, expand by grade; otherwise use total count
        if (Object.keys(grades).length > 0) {
          for (const [gradeKey, countRaw] of Object.entries(grades)) {
            const count = Number(countRaw) || 0;
            const normalizedGrade = normalizeGrade(gradeKey);
            for (let i = 0; i < count; i++) {
              rows.push({
                grade: normalizedGrade,
                user: { schoolName: name },
                scores: { [scoreKey]: value },
              });
            }
          }
        } else {
          const count = Number(school?.count) || 0;
          for (let i = 0; i < count; i++) {
            rows.push({
              user: { schoolName: name },
              scores: { [scoreKey]: value },
            });
          }
        }
      }
    }
  }
  return rows;
};

// Normalize facet mode to 'grade' | 'school'
const facetKind = computed(() => (props.facetMode?.name === 'Grade' ? 'grade' : 'school'));

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const scoreMode = ref({ name: 'Raw Score', key: 'rawScore' });
const scoreModes = [
  { name: 'Raw Score', key: 'rawScore' },
  { name: 'Percentile', key: 'stdPercentile' },
];

const getBinSize = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 10;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return props.taskScoringVersions[taskId] >= 4 ? 70 : 5;
    else if (taskId === 'sre') return props.taskScoringVersions[taskId] >= 5 ? 65 : 10;
    else if (taskId === 'sre-es') return 10;
    else if (taskId === 'letter') return 10;
    else if (taskId === 'swr') return 50;
    else if (taskId === 'swr-es') return 50;
    else if (taskId === 'cva') return 45;
    else if (taskId === 'trog') return 75;
    else if (taskId === 'roar-inference') return 50;
    else if (taskId === 'morphology') return 45;
  }
  return 10;
};

const getRangeLow = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 0;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return props.taskScoringVersions[taskId] >= 4 ? 40 : 0;
    else if (taskId === 'sre') return props.taskScoringVersions[taskId] >= 5 ? 300 : 0;
    else if (taskId === 'sre-es') return 0;
    else if (taskId === 'letter') return 0;
    else if (taskId === 'swr') return 100;
    else if (taskId === 'swr-es') return 100;
    else if (taskId === 'cva') return 287;
    else if (taskId === 'trog') return 53;
    else if (taskId === 'roar-inference') return 300;
    else if (taskId === 'morphology') return 280;
  }
  return 0;
};

const getRangeHigh = (scoreMode, taskId) => {
  if (scoreMode === 'Percentile') {
    return 100;
  } else if (scoreMode === 'Raw Score') {
    if (taskId === 'pa') return props.taskScoringVersions[taskId] >= 4 ? 733 : 57;
    else if (taskId === 'sre') return props.taskScoringVersions[taskId] >= 5 ? 967 : 130;
    else if (taskId === 'sre-es') return 140;
    else if (taskId === 'letter') return 100;
    else if (taskId === 'swr') return 900;
    else if (taskId === 'swr-es') return 900;
    else if (taskId === 'cva') return 753;
    else if (taskId === 'trog') return 800;
    else if (taskId === 'roar-inference') return 793;
    else if (taskId === 'morphology') return 720;
  }
  return 100;
};

// With Percentile View, only display runs under grade 6
const computedRuns = computed(() => {
  if (props.orgType === 'district') {
    const facet = facetKind.value;
    const modeKey = scoreMode.value.name === 'Percentile' ? 'percentile' : 'raw';
    const scoreKey = scoreMode.value.name === 'Percentile' ? 'stdPercentile' : 'rawScore';

    const levels = ['above', 'some', 'below'];
    const rows = [];

    // if backend provided keyed bins (preferred)
    const hasKeyed = levels.some((k) => props?.runs?.[k]?.[modeKey]);
    if (hasKeyed) {
      for (const levelKey of levels) {
        const binsObj = props?.runs?.[levelKey]?.[modeKey];
        if (binsObj) {
          rows.push(...makeRunsFromBins({ binsObj, facet, scoreKey, levelKey }));
        }
      }
    } else {
      // fallback to flat shape: props.runs.percentile / props.runs.raw (no color by level)
      rows.push(...makeRunsFromBins({ binsObj: props?.runs?.[modeKey], facet, scoreKey }));
    }

    // Filter grades for percentile view (only grades < 6)
    if (scoreMode.value.name === 'Percentile') {
      return rows.filter((row) => {
        const gradeNum = row.grade === 'Kindergarten' ? 0 : Number(row.grade);
        return gradeNum < 6;
      });
    }

    return rows;
  }

  // non-district (original)
  if (scoreMode.value.name === 'Percentile' && props.facetMode.name === 'Grade') {
    return props.runs.filter((run) => {
      const gradeNum = run.grade === 'Kindergarten' ? 0 : Number(run.grade);
      return gradeNum < 6;
    });
  }
  return props.runs;
});
const distributionChartFacet = computed(() => {
  if (isLoadingTasksDictionary.value) return {};
  return {
    background: null,
    title: {
      text: `${tasksDictionary.value[props.taskId]?.publicName ?? props.taskId}`,
      subtitle: `${scoreMode.value.name} Distribution By ${props.facetMode.name}`,
      anchor: 'middle',
      fontSize: 18,
      dx: 70,
    },
    data: {
      values: computedRuns.value,
    },
    mark: 'bar',
    height: 50,
    width: 360,
    encoding: {
      row: {
        field: isGradeFacet.value ? 'grade' : `user.${props.facetMode.key}`,
        type: 'ordinal',
        title: '',
        header: {
          titleColor: 'navy',
          titleFontSize: 14,
          titleAlign: 'top',
          titleAnchor: 'middle',
          labelColor: 'navy',
          labelFontSize: 14,
          labelFontStyle: '',
          labelAnchor: 'top',
          labelAngle: 0,
          labelAlign: 'right',
          labelOrient: 'left',
          labelBaseline: 'line-bottom',
          labelPadding: 0,
          labelExpr: isGradeFacet.value
            ? "join(['Grade ',if(datum.value == 'Kindergarten', 'K', datum.value ), ], '')"
            : 'split(test(/^[0-9K] /, datum.value) ? slice(datum.value, 2, datum.value.length) : datum.value, " ")',
          labelLimit: 150,
          labelSeparation: 0,
        },
        spacing: 18,
        sort: isGradeFacet.value
          ? ['Kindergarten', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
          : 'ascending',
      },
      color: {
        value: SCORE_SUPPORT_LEVEL_COLORS['ASSESSED'],
      },

      x: {
        field: `scores.${scoreMode.value.key}`,
        title: scoreMode.value.name,
        bin: {
          step: getBinSize(scoreMode.value.name, props.taskId),
          extent: [getRangeLow(scoreMode.value.name, props.taskId), getRangeHigh(scoreMode.value.name, props.taskId)],
        },
        sort: 'ascending',
        axis: {
          labelAngle: 0,
          labelAlign: 'center',
          titleFontSize: 14,
          labelFontSize: 14,
        },
      },

      y: {
        type: 'quantitative',
        aggregate: 'count',
        title: 'Count',
        sort: 'ascending',
        axis: {
          labelBaseline: 'right',
          titleFontSize: 14,
          labelLimit: 180,
          labelPadding: 8,
          labelFontSize: 14,
          labelColor: 'navy',
          labelFontStyle: '',
          format: '.0f',
        },
      },
      tooltip: [{ aggregate: 'count', title: 'Student Count' }],
    },
    resolve: {
      scale: {
        y: 'independent',
      },
    },
  };
});

const draw = async () => {
  const chartSpecDist = distributionChartFacet.value;

  // Don't draw if chart spec is empty (still loading)
  if (!chartSpecDist || Object.keys(chartSpecDist).length === 0) {
    return;
  }

  await embed(`#roar-distribution-chart-${props.taskId}`, chartSpecDist);
};

const isGradeFacet = computed(() => props.facetMode.key === 'grade');

// Watch for changes to the computed chart specification (includes tasksDictionary loading)
watch(
  () => distributionChartFacet.value,
  () => {
    draw();
  },
  { deep: true },
);

// Update Distribution Graph on external facetMode change
watch(
  () => props.facetMode,
  () => {
    draw();
  },
);

// Update Distribution Graph on computedRuns recalculation
watch(
  () => computedRuns,
  () => {
    draw();
  },
  { deep: true },
);

// Update Distribution Graph on internal scoreMode change
const handleModeChange = () => {
  draw();
};

onMounted(() => {
  draw(); // Call your function when the component is mounted
});
</script>

<style lang="scss">
.view-by-wrapper {
  display: flex;
  flex-direction: column;
  align-items: space-around;
}

.distribution-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  height: 100%;
}
</style>
