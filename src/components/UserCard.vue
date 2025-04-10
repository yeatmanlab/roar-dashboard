<template>
  <div class="flex flex-column bg-gray-200 m-4 border-gray-800 w-lg card-container rounded">
    <!-- User Header -->
    <div class="flex flex-column bg-red-800 text-white p-3 gap-2">
      <div class="font-bold bg-red-800">
        {{ userName }}
        <div class="font-light text-sm text-red-200">User</div>
      </div>
      <div class="flex gap-2">
        <div class="text-sm">
          {{ user.studentData.grade }}
          <div class="font-light text-xs text-red-200">Grade</div>
        </div>
        <div class="text-sm">
          {{ _capitalize(user.studentData.schoolLevel) }}
          <div class="font-light text-xs text-red-200">School Level</div>
        </div>
      </div>
    </div>
    <!-- Administration Header -->
    <div class="flex flex-column p-3 gap-2">
      <div class="flex flex-wrap justify-between align-center">
        <div class="flex flex-column">
          <div class="text-lg">{{ assignment.name }}</div>
          <div class="text-xs font-light">Administration</div>
        </div>
        <div class="flex flex-column">
          <div class="text-sm">{{ parseDate(assignment.dateOpened) }} - {{ parseDate(assignment.dateClosed) }}</div>
          <div class="text-xs font-light">Dates Active</div>
        </div>
      </div>
    </div>
    <div></div>
    <!-- Task specific Data -->
    <div class="bg-gray-100 flex flex-column p-3 gap-1">
      <div class="text-xs font-light">Tasks</div>
      <div v-for="(status, task) in assignment.progress" :key="task">
        <div class="flex text-sm justify-between">
          <div class="flex flex-column">
            <div>{{ taskDisplayNames[task].publicName }}</div>
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
      <div class="flex flex-wrap justify-between mt-2">
        <a :href="'/launch/' + roarUid">
          <PvButton :label="'Play Assessments for ' + userName" data-cy="play-assessments-btn" />
        </a>
        <a :href="'/scores/' + props.administrationId + '/' + props.orgType + '/' + props.orgId + '/user/' + roarUid">
          <PvButton label="View Score Report" icon="" text data-cy="view-score-report-btn" />
        </a>
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
@media (min-width: 1200px) {
  .card-container {
    max-width: 400px;
  }
}
.card-container {
  max-width: 400px;
}
</style>
