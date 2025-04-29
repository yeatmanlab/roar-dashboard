<template>
  <div class="flex flex-column bg-gray-200 m-4 bg-red-800 card-container rounded">
    <!-- User Header -->
    <div class="flex flex-column bg-red-800 text-white p-3 gap-2">
      <div class="font-bold text-2xl">
        {{ userName }}
        <div class="font-light text-sm text-white">Student</div>
      </div>
      <div class="flex gap-2">
        <div class="text-sm">
          {{ user.studentData.grade }}
          <div class="font-light text-xs text-white">Grade</div>
        </div>
        <div class="text-sm">
          {{ _capitalize(user.studentData.schoolLevel) }}
          <div class="font-light text-xs text-white">School Level</div>
        </div>
      </div>
    </div>
    <!-- Task specific Data -->
    <div class="bg-gray-200 flex flex-column p-3 gap-1">
      <PvAccordion value="0">
        <PvAccordionPanel value="0">
          <PvAccordionHeader>
            <!-- Administration Header -->
            <div class="flex flex-column p-3 gap-2 w-full">
              <div class="flex gap-2 flex-wrap justify-between align-center">
                <div class="flex flex-column">
                  <div class="text-lg">{{ assignment.name }}</div>
                  <div class="text-xs font-light">Assignment</div>
                </div>
                <div class="flex flex-column">
                  <div class="text-sm">
                    {{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}
                  </div>
                  <div class="text-xs font-light">Dates Active</div>
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
                    <PvButton label="View Scores" icon="" text data-cy="view-score-report-btn" />
                  </router-link>
                </div>
              </div>
            </div>
          </PvAccordionHeader>
          <PvAccordionContent>
            <div class="text-md font-bold mb-2">Progress by Tasks</div>
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
  if (user?.name?.first && props.user?.name?.last) {
    return user?.name?.first + props.user?.name?.last;
  } else if (user?.name?.first) {
    return user?.name?.first;
  }
  return props.assignment.user?.username;
});
</script>

<style>
@media (max-width: 468px) {
  .card-container {
    min-width: 300px;
  }
}
@media (min-width: 800px) {
  .card-container {
    min-width: 600px;
  }
}
</style>
