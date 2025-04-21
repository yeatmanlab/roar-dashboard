<template>
  <div class="flex flex-column bg-gray-200 m-4 border-gray-800 w-lg card-container rounded">
    <!-- Administration Header -->
    <div class="flex flex-column p-3 gap-2 bg-red-800 text-white">
      <div class="flex gap-2 flex-wrap justify-between align-center">
        <div class="flex flex-column">
          <div class="text-lg">{{ assignment.name }}</div>
          <div class="text-xs font-light">Assignment</div>
        </div>
        <div class="flex flex-column">
          <div class="text-sm">{{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}</div>
          <div class="text-xs font-light">Dates Active</div>
        </div>
      </div>
    </div>
    <!-- User Header -->
    <div class="flex flex-wrap items-center justify-between">
      <div class="flex flex-column bg-gray-200 p-3 gap-2">
        <div class="font-bold bg-gray-200 text-lg">
          {{ userName }}
          <div class="font-light text-sm text-gray-600">User</div>
        </div>
        <div class="flex gap-2">
          <div class="text-sm">
            {{ user.studentData.grade }}
            <div class="font-light text-xs text-gray-600">Grade</div>
          </div>
          <div class="text-sm">
            {{ _capitalize(user.studentData.schoolLevel) }}
            <div class="font-light text-xs text-gray-600">School Level</div>
          </div>
        </div>
      </div>
      <div class="flex align-items-end p-2">
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
    </div>
    <!-- Task specific Data -->
    <div class="bg-gray-100 flex flex-column p-3 gap-1">
      <div class="text-xs font-light">Tasks</div>
      <div v-for="(status, task) in assignment.progress" :key="task">
        <div class="flex text-sm justify-between">
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
      <div class="flex flex-wrap justify-content-end mt-2">
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
.card-container {
  max-width: 400px;
}
</style>
