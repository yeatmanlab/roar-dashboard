<template>
  <article class="flex overflow-hidden rounded border-gray-200 flex-column border-1">
    <div class="flex gap-2 p-3 bg-gray-100 flex-column">
      <h2 class="m-0 text-xl font-bold">
        {{ userName }}
        <div class="text-sm font-light">Student</div>
      </h2>
      <div class="flex gap-4 mt-2 font-normal text-gray-500">
        <div class="text-sm">
          {{ getGradeToDisplay(userData?.studentData?.grade) }}
        </div>
        <div class="text-sm">
          {{ _capitalize(userData?.studentData?.schoolLevel) }}
          <span class="">School</span>
        </div>
      </div>
    </div>

    <PvAccordion :active-index="0">
      <PvAccordionTab v-for="assignment in assignments" :key="assignment.id">
        <template #header>
          <div class="flex justify-between w-full">
            <div>
              <div class="text-md">{{ assignment.name }}</div>
              <div class="mt-1 text-xs font-light">Assignment</div>
            </div>
            <div>
              <div class="mt-1 text-sm">
                {{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}
              </div>
              <div class="mt-1 text-xs font-light text-end">Dates Active</div>
            </div>
          </div>
        </template>

        <div class="flex gap-3 flex-column">
          <div class="flex gap-4 justify-content-between">
            <router-link :to="{ name: 'LaunchParticipant', params: { launchId: userId } }">
              <PvButton label="Play Games" data-cy="play-assessments-btn" />
            </router-link>
            <router-link
              :to="{
                name: 'StudentReport',
                params: {
                  administrationId: props.administrationId,
                  orgType: props.orgType,
                  orgId: props.orgId,
                  userId: userId,
                },
              }"
              class="text-black no-underline"
            >
              <PvButton label="View Scores" icon="" outlined severity="contrast" data-cy="view-score-report-btn" />
            </router-link>
          </div>

          <div class="flex gap-3 mt-3 flex-column">
            <h4 class="m-0 font-semibold text-md">Progress by Tasks</h4>
            <div class="flex gap-1 flex-column">
              <div
                v-for="assessment in assignment.assessments"
                :key="assessment.taskId"
                class="flex justify-between text-sm align-items-center"
              >
                <div>{{ taskDisplayNames[assessment.taskId]?.publicName }}</div>
                <div>
                  <PvTag
                    :severity="getAssessmentStatus(assessment).severity"
                    :value="getAssessmentStatus(assessment).value"
                    :icon="getAssessmentStatus(assessment).icon"
                    class="p-0.5 m-0 font-semibold capitalize"
                    :style="`min-width: 2rem;`"
                    rounded
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </PvAccordionTab>
    </PvAccordion>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { taskDisplayNames, getGradeToDisplay, progressTags } from '@/helpers/reports.js';
import _capitalize from 'lodash/capitalize';
import PvTag from 'primevue/tag';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
import PvAccordionTab from 'primevue/accordiontab';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';

const getAssessmentStatus = (assessment) => {
  if (assessment.completedOn) {
    return progressTags.Completed;
  }
  if (assessment.startedOn) {
    return progressTags.Started;
  }
  return progressTags.Assigned;
};

const props = defineProps({
  assignments: { type: Object, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  administrationId: { type: String, required: true },
  userId: { type: String, required: true },
});

const { data: userData } = useUserDataQuery(props.userId);

const userName = computed(() => {
  if (!userData.value) return '';
  console.log('userdat', userData);
  const { first, last } = userData.value?.name || {};
  if (first && last) {
    return `${first} ${last}`;
  }

  return first || userData.value?.username;
});

const parseDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US');
};
</script>
