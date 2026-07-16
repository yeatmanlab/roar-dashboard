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
  facets: {
    // Per-task facet aggregation from `getScoreFacets` (scoreBinsByGrade /
    // scoreBinsBySchool). Each bin is `{ binStart, binEnd, count }`, already
    // computed server-side. Null while the query is loading.
    type: Object,
    required: false,
    default: null,
  },
  minGradeByRuns: {
    type: Number,
    required: true,
  },
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

// Normalize facet mode to 'grade' | 'school'
const facetKind = computed(() => (props.facetMode?.name === 'Grade' ? 'grade' : 'school'));
const isGradeFacet = computed(() => props.facetMode.key === 'grade');

const scoreMode = ref({ name: 'Raw Score', key: 'rawScore' });
const scoreModes = [
  { name: 'Raw Score', key: 'rawScore' },
  { name: 'Percentile', key: 'stdPercentile' },
];

// Leading-zero trim matches the prior client behavior (e.g. "01" → "1").
const trimGrade = (grade) => String(grade ?? '').replace(/^0+(?=\D|\d)/, '');
// Kindergarten / "0" sort as grade 0; everything else is its numeric grade.
const gradeNumeric = (grade) => (grade === '0' || grade === 'Kindergarten' ? 0 : Number(grade));

const facetEntries = computed(() => {
  if (!props.facets) return [];
  return facetKind.value === 'grade' ? (props.facets.scoreBinsByGrade ?? []) : (props.facets.scoreBinsBySchool ?? []);
});

// Flatten the per-facet pre-binned distributions into Vega rows. The backend bins
// (`{ binStart, binEnd, count }`) are consumed directly via `bin: 'binned'` — no
// client-side re-binning, so the histogram exactly reflects the server aggregation.
const binValues = computed(() => {
  const scoreKey = scoreMode.value.key === 'stdPercentile' ? 'percentile' : 'rawScore';
  const rows = [];
  for (const entry of facetEntries.value) {
    if (facetKind.value === 'grade') {
      const gradeNum = gradeNumeric(entry.grade);
      // Percentile view is only meaningful for early grades — preserve the prior <6 filter.
      if (scoreMode.value.key === 'stdPercentile' && gradeNum >= 6) continue;
      for (const bin of entry[scoreKey] ?? []) {
        rows.push({
          facet: trimGrade(entry.grade),
          gradeNumeric: gradeNum,
          binStart: bin.binStart,
          binEnd: bin.binEnd,
          count: bin.count,
        });
      }
    } else {
      const name = entry.schoolName ?? 'Unknown school';
      for (const bin of entry[scoreKey] ?? []) {
        rows.push({ facet: name, gradeNumeric: null, binStart: bin.binStart, binEnd: bin.binEnd, count: bin.count });
      }
    }
  }
  return rows;
});

// Percentile is a fixed 0–100 axis; raw-score axes fit the server's bin range.
const xDomain = computed(() => {
  if (scoreMode.value.key === 'stdPercentile') return [0, 100];
  const starts = binValues.value.map((b) => b.binStart);
  const ends = binValues.value.map((b) => b.binEnd);
  if (!starts.length) return [0, 100];
  return [Math.min(...starts), Math.max(...ends)];
});

const distributionChartFacet = computed(() => {
  if (isLoadingTasksDictionary.value) return {};
  return {
    background: null,
    title: {
      text: `${tasksDictionary.value[props.taskId]?.nameSimple ?? props.taskId}`,
      subtitle: `${scoreMode.value.name} Distribution By ${props.facetMode.name}`,
      anchor: 'middle',
      fontSize: 18,
      dx: 70,
    },
    data: {
      values: binValues.value,
    },
    mark: 'bar',
    height: 50,
    width: 360,
    encoding: {
      row: {
        field: isGradeFacet.value ? 'gradeNumeric' : 'facet',
        type: isGradeFacet.value ? 'quantitative' : 'ordinal',
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
            ? "join(['Grade ',if(datum.value == '0', 'K', datum.value ), ], '')"
            : 'split(test(/^[0-9K] /, datum.value) ? slice(datum.value, 2, datum.value.length) : datum.value, " ")',
          labelLimit: 150,
          labelSeparation: 0, // Set the spacing between lines in pixels
        },
        spacing: 18,
        sort: 'ascending',
      },
      color: {
        value: SCORE_SUPPORT_LEVEL_COLORS['ASSESSED'],
      },

      x: {
        field: 'binStart',
        bin: 'binned',
        type: 'quantitative',
        title: scoreMode.value.name,
        scale: { domain: xDomain.value },
        sort: 'ascending',
        axis: {
          labelAngle: 0,
          labelAlign: 'center',
          titleFontSize: 14,
          labelFontSize: 14,
        },
      },
      x2: { field: 'binEnd' },

      y: {
        field: 'count',
        type: 'quantitative',
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
      tooltip: [
        { field: 'binStart', title: `${scoreMode.value.name} (min)`, type: 'quantitative', format: '.0f' },
        { field: 'binEnd', title: `${scoreMode.value.name} (max)`, type: 'quantitative', format: '.0f' },
        isGradeFacet.value ? { field: 'gradeNumeric', title: 'Student Grade' } : { field: 'facet', title: 'School' },
        { field: 'count', title: 'Student Count', type: 'quantitative' },
      ],
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

// Redraw whenever the computed chart spec changes (covers facets, facetMode,
// scoreMode, and tasksDictionary loading).
watch(
  () => distributionChartFacet.value,
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
