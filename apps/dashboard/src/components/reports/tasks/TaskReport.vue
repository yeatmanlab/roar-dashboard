<template>
  <div :id="'tab-view-description-' + taskId" class="flex flex-col items-center justify-center mx-2">
    <div>
      <div style="text-transform: uppercase" class="text-2xl font-bold mt-3">{{ taskInfoById[taskId]?.subheader }}</div>
      <!-- The following HTML is from a hard-coded source (below) -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <p class="mt-1 text-md font-light mb-3" v-html="taskDesc"></p>
    </div>
  </div>
  <div v-if="tasksToDisplayGraphs.includes(taskId)" :id="'tab-view-chart-' + taskId" class="chart-toggle-wrapper">
    <div v-if="hasSchoolFacets" class="mb-3" data-html2canvas-ignore="true">
      <div class="flex uppercase text-xs font-light justify-content-center align-items-center">view rows by</div>
      <PvSelectButton
        v-model="facetMode"
        class="flex flex-row my-2 select-button"
        :allow-empty="false"
        :options="facetModes"
        option-label="name"
      />
    </div>
    <div class="chart-wrapper align-items-start">
      <div class="h-full flex flex-column align-items-center">
        <DistributionChartSupport
          :initialized="initialized"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :task-id="taskId"
          :facets="facets"
          :facet-mode="facetMode"
        />
      </div>
      <div class="h-full flex">
        <DistributionChartFacet
          :initialized="initialized"
          :administration-id="administrationId"
          :org-type="orgType"
          :org-id="orgId"
          :task-id="taskId"
          :facets="facets"
          :facet-mode="facetMode"
          :min-grade-by-runs="minGradeByRuns"
        />
      </div>
    </div>
  </div>
  <div v-if="orgType !== 'district'" class="my-2 mx-4">
    <SubscoreTable
      v-if="tasksWithSubscores.includes(taskId) && !isLoadingTasksDictionary"
      :task-id="taskId"
      :task-uuid="taskUuid || taskId"
      :task-name="tasksDictionary[taskId]?.nameSimple ?? taskId"
      :administration-id="administrationId"
      :org-type="orgType"
      :org-id="orgId"
      :administration-name="administrationInfo.name ?? undefined"
      :org-name="orgInfo.name ?? undefined"
    />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue';
import PvSelectButton from 'primevue/selectbutton';
import { tasksToDisplayGraphs, taskInfoById, replaceScoreRange } from '@/helpers/reports.js';
import useTasksDictionaryQuery from '@/composables/queries/useTasksDictionaryQuery.js';
import SubscoreTable from '@/components/reports/SubscoreTable.vue';
import DistributionChartFacet from '@/components/reports/DistributionChartFacet.vue';
import DistributionChartSupport from '@/components/reports/DistributionChartSupport.vue';

const props = defineProps({
  initialized: {
    type: Boolean,
    required: true,
  },
  administrationId: {
    type: String,
    required: true,
  },
  administrationInfo: {
    type: Object,
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
  orgInfo: {
    type: Object,
    required: true,
  },
  taskId: {
    type: String,
    required: true,
  },
  taskUuid: {
    // Task UUID for the subscores endpoint (path param); resolved upstream from
    // the report's task metadata. Empty until that loads.
    type: String,
    default: '',
  },
  facets: {
    // Per-task facet aggregation from `getScoreFacets`; null while loading.
    type: Object,
    required: false,
    default: null,
  },
  taskScoringVersions: {
    type: Object,
    required: true,
  },
});

const { data: tasksDictionary, isLoading: isLoadingTasksDictionary } = useTasksDictionaryQuery();

const facetMode = ref({ name: 'Grade', key: 'grade' });
const facetModes = [
  { name: 'Grade', key: 'grade' },
  { name: 'School', key: 'schoolName' },
];

// Tasks with a registered backend subscore schema — only these render a subscore
// table. Others (e.g. SWR/SRE) have no subscore schema and 400 from the endpoint.
const tasksWithSubscores = ['phonics', 'letter', 'letter-en-ca', 'pa', 'fluency-calf', 'fluency-arf', 'roam-alpaca'];

// Kindergarten / "0" sort as grade 0; everything else is its numeric grade.
const gradeNumeric = (grade) => (grade === '0' || grade === 'Kindergarten' ? 0 : Number(grade));

// Lowest grade present in the task's grade facets — drives whether the facet chart
// offers the Raw/Percentile toggle (percentile is meaningful for early grades only).
const minGradeByRuns = computed(() => {
  const grades = (props.facets?.scoreBinsByGrade ?? [])
    .map((entry) => gradeNumeric(entry.grade))
    .filter((n) => Number.isFinite(n));
  return grades.length ? Math.min(...grades) : 0;
});

// The school-facet toggle is shown only when the backend supplies school facets,
// which happens at district scope (empty arrays elsewhere). This replaces the prior
// explicit `orgType === 'district'` check — the data drives the UI.
const hasSchoolFacets = computed(() => (props.facets?.supportLevelBySchool?.length ?? 0) > 0);

const taskDesc = computed(() => {
  return replaceScoreRange(taskInfoById[props.taskId]?.desc, props.taskId, props.taskScoringVersions[props.taskId]);
});
</script>

<style>
.chart-wrapper {
  display: flex;
  height: 100%;
  flex-wrap: wrap;
  justify-content: space-around;
}

.chart-toggle-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.task-card {
  background: #f6f6fe;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1rem;
}

.task-title {
  font-size: 3.5rem;
  /* font-weight: bold; */
}

.task-description {
  font-size: 1.25rem;
  text-align: left;
}
</style>
