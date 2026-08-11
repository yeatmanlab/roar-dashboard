<template>
  <div>
    <ReportHeader
      :org-type="orgType"
      :org-name="orgName"
      :administration-name="administrationName"
      report-type="Score"
      :report-view="reportView"
      :report-views="reportViews"
      @view-change="$emit('view-change', $event)"
    >
      <template #export-buttons>
        <slot name="export-buttons" />
      </template>
    </ReportHeader>
    <div v-if="isLoadingAssignments || isLoadingDistrictSupportCategories" class="loading-wrapper">
      <AppSpinner style="margin: 1rem 0rem" />
      <div class="text-sm font-light text-gray-600 uppercase">Loading Overview Charts</div>
    </div>
    <div
      v-if="!isLoadingAssignments && !isLoadingDistrictSupportCategories && sortedAndFilteredTaskIds?.length > 0"
      class="py-3 mb-2 text-left"
    >
      <ScoreDistributionOverview
        :task-ids="sortedAndFilteredTaskIds"
        :support-levels-by-task-id="supportLevelsByTaskId"
        :composite-foundational-runs="compositeFoundationalRuns"
        :tasks-dictionary="tasksDictionary"
      />
      <!-- One/all of word, sentence, phoneme have been taken, but additionally they have other assessments that do not show charts (we want to say we only show charts for validated assessments)  -->
      <div
        v-if="
          !isLoadingAssignments &&
          sortedAndFilteredTaskIds?.length > 0 &&
          !isEmptyDistrictSupportCategories &&
          orgType === 'district'
        "
        class="flex rounded flex-column align-items-center mt-3"
      >
        <p
          v-if="assignedNormedTaskIds && assignedTaskIds.length > assignedNormedTaskIds.length"
          class="text-center text-sm font-bold px-4"
        >
          In this district-level report, visualizations are available for foundational and comprehension assessments to
          give you clear, reliable insights on these skills.
        </p>
        <p class="text-center align-items-center text-sm font-bold px-4">
          View school-level or classroom-level reports to see student-level data and information about other
          assessments.
        </p>
      </div>
    </div>
    <div
      v-if="!isLoadingAssignments && !isLoadingDistrictSupportCategories && isEmptyDistrictSupportCategories"
      class="justify-content-center surface-100 p-2"
    >
      <p class="text-center text-sm font-bold px-4">
        {{
          assignedNormedTaskIds.length === 0
            ? 'Visualizations are only available for foundational reading and comprehension assessments. If visualizations are not showing, your students were not assigned any of these assessments.'
            : 'Visualizations will appear once students complete our foundational or comprehension assessments.'
        }}
      </p>
      <p class="text-center align-items-center text-sm font-bold px-4">
        View school-level or classroom-level reports to see student-level data and information about other assessments.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import ReportHeader from '@/components/ReportHeader.vue';
import ScoreDistributionOverview from '@/components/reports/ScoreDistributionOverview.vue';
import { SCORE_SUPPORT_SKILL_LEVELS } from '@/constants/scores';

const props = defineProps({
  orgType: {
    type: String,
    required: true,
  },
  orgName: {
    type: String,
    default: '',
  },
  administrationName: {
    type: String,
    required: true,
  },
  reportView: {
    type: Object,
    required: true,
  },
  reportViews: {
    type: Array,
    required: true,
  },
  isLoadingAssignments: {
    type: Boolean,
    default: false,
  },
  isLoadingDistrictSupportCategories: {
    type: Boolean,
    default: false,
  },
  isEmptyDistrictSupportCategories: {
    type: Boolean,
    default: false,
  },
  sortedAndFilteredTaskIds: {
    type: Array,
    default: () => [],
  },
  runsByTaskIdForDistributionChart: {
    type: Object,
    default: () => ({}),
  },
  tasksDictionary: {
    type: Object,
    default: () => ({}),
  },
  assignedNormedTaskIds: {
    type: Array,
    default: () => [],
  },
  assignedTaskIds: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['view-change']);

// Transform runs-based data into the support-level format expected by ScoreDistributionOverview
const supportLevelsByTaskId = computed(() => {
  const result = {};
  for (const taskId of props.sortedAndFilteredTaskIds) {
    const runs = props.runsByTaskIdForDistributionChart?.[taskId];
    if (!runs) {
      result[taskId] = { needsExtraSupport: { count: 0 }, developingSkill: { count: 0 }, achievedSkill: { count: 0 } };
      continue;
    }

    if (props.orgType === 'district') {
      // District-aggregated format
      result[taskId] = {
        needsExtraSupport: { count: runs.below?.total ?? 0 },
        developingSkill: { count: runs.some?.total ?? 0 },
        achievedSkill: { count: runs.above?.total ?? 0 },
      };
    } else {
      // Individual runs format (school/class/group scope)
      const counts = { needsExtraSupport: 0, developingSkill: 0, achievedSkill: 0 };
      for (const run of runs) {
        const supportLevel = run.scores?.support_level;
        if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.NEEDS_EXTRA_SUPPORT) counts.needsExtraSupport++;
        else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.DEVELOPING_SKILL) counts.developingSkill++;
        else if (supportLevel === SCORE_SUPPORT_SKILL_LEVELS.ACHIEVED_SKILL) counts.achievedSkill++;
      }
      result[taskId] = {
        needsExtraSupport: { count: counts.needsExtraSupport },
        developingSkill: { count: counts.developingSkill },
        achievedSkill: { count: counts.achievedSkill },
      };
    }
  }
  return result;
});

// Extract composite foundational runs from the runs data
const compositeFoundationalRuns = computed(() => props.runsByTaskIdForDistributionChart?.compositeFoundational ?? null);
</script>
