<template>
  <article
    class="flex overflow-hidden mx-auto w-full max-w-3xl rounded border-gray-200 flex-column border-1"
    data-cy="student-card-simple"
  >
    <div class="flex gap-2 p-4 bg-gray-100 flex-column">
      <h2 class="m-0 text-xl font-bold" data-cy="student-card__name">
        {{ userName }}
        <div class="text-sm font-light">Student</div>
      </h2>
      <div class="flex gap-4 mt-2 font-normal text-gray-500">
        <div v-if="userData?.studentData?.grade" class="text-sm">
          {{ getGradeToDisplay(userData.studentData.grade) }}
        </div>
        <div v-if="userData?.studentData?.schoolLevel" class="text-sm">
          {{ _capitalize(userData.studentData.schoolLevel) }}
          <span class="">School</span>
        </div>
      </div>
    </div>

    <!-- Launch Button -->
    <div class="flex p-4 border-t border-gray-200">
      <PvButton
        label="Launch as Student"
        icon="pi pi-play"
        class="w-full"
        severity="primary"
        data-cy="launch-student-btn"
        @click="launchAsStudent"
      />
    </div>

    <!-- Assignments Section -->
    <div v-if="hasAssignments" class="flex p-4 border-t border-gray-200 flex-column">
      <h3 class="m-0 mb-3 font-semibold text-gray-500 text-md">Assignments</h3>
      <div class="flex gap-3 flex-column">
        <div
          v-for="assignment in assignments"
          :key="assignment.id"
          class="p-3 bg-gray-50 rounded border-gray-200 border-1"
        >
          <div class="flex justify-between mb-2 align-items-center">
            <div>
              <div class="font-semibold text-sm">{{ assignment.name }}</div>
              <div class="text-xs text-gray-500 mt-1">
                {{ formatDate(assignment.dateOpened) }} - {{ formatDate(assignment.dateClosed) }}
              </div>
            </div>
          </div>

          <!-- Progress indicators -->
          <div class="flex gap-1 mt-2 mb-3 flex-column">
            <div
              v-for="assessment in assignment.assessments"
              :key="assessment.taskId"
              class="flex justify-between text-sm align-items-center"
            >
              <div class="text-xs">{{ getTaskName(assessment.taskId) }}</div>
              <PvTag
                :severity="getAssessmentStatus(assessment).severity"
                :value="getAssessmentStatus(assessment).value"
                :icon="getAssessmentStatus(assessment).icon"
                class="p-0.5 m-0 text-xs font-semibold capitalize"
                rounded
              />
            </div>
          </div>

          <!-- View Scores Button for this assignment -->
          <router-link
            :to="{
              name: 'StudentScoreReport',
              params: {
                administrationId: assignment.id,
                orgType: props.orgType,
                orgId: props.orgId,
                userId: props.userId,
              },
            }"
            class="text-black no-underline"
          >
            <PvButton
              label="View Scores"
              icon="pi pi-chart-bar"
              outlined
              severity="contrast"
              class="w-full"
              size="small"
              data-cy="view-score-report-btn"
            />
          </router-link>
        </div>
      </div>
    </div>

    <!-- No Assignments Message -->
    <div v-else class="flex p-4 border-t border-gray-200">
      <div class="text-sm text-gray-500 text-center w-full">No assignment score data is found.</div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { getGradeToDisplay, taskDisplayNames, progressTags } from '@/helpers/reports.js';
import _capitalize from 'lodash/capitalize';
import PvButton from 'primevue/button';
import PvTag from 'primevue/tag';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserAssignmentsQuery from '@/composables/queries/useUserAssignmentsQuery';
import router from '@/router/index.js';

const props = defineProps({
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  userId: { type: String, required: true },
});

const { data: userData } = useUserDataQuery(props.userId);

// Fetch assignments for this student
const { data: userAssignments } = useUserAssignmentsQuery(
  undefined, // queryOptions
  props.userId, // userId
  computed(() => props.orgType), // orgType
  computed(() => [props.orgId]), // orgIds
);

const assignments = computed(() => {
  return userAssignments.value || [];
});

const hasAssignments = computed(() => {
  return assignments.value.length > 0;
});

const userName = computed(() => {
  if (!userData.value) return 'Loading...';
  const { first, last } = userData.value?.name || {};
  if (first && last) {
    return `${first} ${last}`;
  }

  return first || userData.value?.username || 'Student';
});

const launchAsStudent = () => {
  router.push({
    name: 'LaunchParticipant',
    params: { launchId: props.userId },
  });
};

const getTaskName = (taskId) => {
  return taskDisplayNames[taskId]?.publicName || taskId;
};

const getAssessmentStatus = (assessment) => {
  if (assessment.completedOn) {
    return progressTags.Completed;
  }
  if (assessment.startedOn) {
    return progressTags.Started;
  }
  return progressTags.Assigned;
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
</script>
