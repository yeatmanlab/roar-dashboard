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
        :runs-by-task-id="runsByTaskIdForDistributionChart"
        :org-type="orgType"
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
import ReportHeader from '@/components/ReportHeader.vue';
import ScoreDistributionOverview from '@/components/reports/ScoreDistributionOverview.vue';

defineProps({
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
</script>
