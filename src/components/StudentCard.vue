<template>
  <div class="flex flex-column bg-gray-100 bg-gray-100 rounded border-1 border-gray-300 m-2">
    <!-- StudentCard component for displaying individual student information -->
    <!-- User Header -->
    <div class="flex flex-column bg-gray-100 p-3 gap-2">
      <div class="font-bold text-xl">
        {{ userName }}
        <div class="font-light text-sm">Student</div>
      </div>
      <div class="flex font-normal gap-2 text-gray-500">
        <div class="text-sm">
          {{ getGradeWithSuffix(user.studentData.grade) }}
          <span class="">Grade</span>
        </div>
        <div class="text-sm">
          {{ _capitalize(user.studentData.schoolLevel) }}
          <span class="">School</span>
        </div>
      </div>
    </div>
    <!-- Task specific Data -->
    <div class="flex flex-column gap-1 border-t-1 border-gray-300">
      <PvAccordion value="0">
        <template #collapseicon>
          <i class="pi pi-chevron-up ml-4"></i>
        </template>
        <template #expandicon>
          <i class="pi pi-chevron-down ml-4"></i>
        </template>
        <PvAccordionPanel value="0">
          <PvAccordionHeader class="border-1">
            <!-- Administration Header -->
            <div class="flex flex-column gap-2 w-full">
              <div class="flex gap-2 flex-wrap justify-between align-center">
                <div class="flex flex-column">
                  <div class="text-md">{{ assignment.name }}</div>
                  <div class="text-xs font-light">Assignment</div>
                </div>
                <div class="flex flex-column">
                  <div class="text-sm">
                    {{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}
                  </div>
                  <div class="text-xs font-light text-end">Dates Active</div>
                </div>
              </div>
              <div class="flex flex-wrap items-end justify-content-between mt-1">
                <div class="flex align-items-end">
                  <router-link
                    :to="{
                      name: 'LaunchParticipant',
                      params: { launchId: roarUid },
                    }"
                    class="no-underline text-black"
                  >
                    <PvButton :label="'Play Games'" data-cy="play-assessments-btn" />
                  </router-link>
                </div>
                <div class="flex flex-wrap justify-content-end">
                  <router-link
                    :to="{
                      name: 'StudentReport',
                      params: {
                        administrationId: props.administrationId,
                        orgType: props.orgType,
                        orgId: props.orgId,
                        userId: roarUid,
                      },
                    }"
                    class="no-underline text-black"
                  >
                    <PvButton
                      label="View Scores"
                      icon=""
                      outlined
                      severity="secondary"
                      data-cy="view-score-report-btn"
                    />
                  </router-link>
                </div>
              </div>
            </div>
          </PvAccordionHeader>
          <PvAccordionContent>
            <div class="text-md font-bold py-3">Progress by Tasks</div>
            <div v-for="(status, task) in assignment.progress" :key="task" class="flex flex-column">
              <div class="flex text-sm justify-between p-1">
                <div class="flex flex-column">
                  <div>{{ taskDisplayNames[task]?.publicName }}</div>
                </div>
                <div>
                  <PvTag
                    :severity="progressTags[_capitalize(status)]?.severity"
                    :value="progressTags[_capitalize(status)]?.value"
                    :icon="progressTags[_capitalize(status)]?.icon"
                    class="p-0.5 m-0 font-bold"
                    :style="`min-width: 2rem; font-weight: bold;`"
                    rounded
                  />
                </div>
              </div>
            </div>
          </PvAccordionContent>
        </PvAccordionPanel>
      </PvAccordion>
    </div>
    <!-- view Score Report and Task Launching-->
    <div class="flex justify-center"></div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { taskDisplayNames, progressTags } from '@/helpers/reports.js';
import _capitalize from 'lodash/capitalize';
import PvTag from 'primevue/tag';
import PvButton from 'primevue/button';
import PvAccordion from 'primevue/accordion';
import PvAccordionPanel from 'primevue/accordionpanel';
import PvAccordionHeader from 'primevue/accordionheader';
import PvAccordionContent from 'primevue/accordioncontent';
import { getGradeWithSuffix } from '@/helpers/reports.js';

const props = defineProps({
  assignment: { type: Object, required: true },
  orgType: { type: String, required: true },
  orgId: { type: String, required: true },
  administrationId: { type: String, required: true },
});

const { user, assignment, roarUid } = props.assignment;

const parseDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US');
};

const userName = computed(() => {
  const { first, last } = user?.name || {};
  const { username } = props.assignment?.user || {};

  if (first && last) {
    return `${first} ${last}`;
  }

  return first || username;
});
</script>
