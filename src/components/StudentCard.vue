<template>
  <article class="flex overflow-hidden rounded border-gray-200 flex-column border-1">
    <div class="flex gap-2 p-3 bg-gray-100 flex-column">
      <h2 class="m-0 text-xl font-bold">
        {{ userName }}
        <div class="text-sm font-light">Student</div>
      </h2>
      <div class="flex gap-4 mt-2 font-normal text-gray-500">
        <div class="text-sm">
          {{ getGradeToDisplay(user.studentData.grade) }}
        </div>
        <div class="text-sm">
          {{ _capitalize(user.studentData.schoolLevel) }}
          <span class="">School</span>
        </div>
      </div>
    </div>

    <div class="flex gap-1 border-t border-gray-200 flex-column">
      <div class="flex gap-3 p-3 flex-column">
        <div class="flex gap-4 justify-between">
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

        <div class="flex mt-1 justify-content-between">
          <router-link :to="{ name: 'LaunchParticipant', params: { launchId: roarUid } }">
            <PvButton label="Play Games" data-cy="play-assessments-btn" />
          </router-link>

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
            class="text-black no-underline"
          >
            <PvButton label="View Scores" icon="" outlined severity="contrast" data-cy="view-score-report-btn" />
          </router-link>
        </div>
      </div>

      <div class="flex gap-3 p-3 border-t border-gray-200 flex-column">
        <h4 class="m-0 font-semibold text-md">Progress by Tasks</h4>
        <div class="flex gap-1 flex-column">
          <div
            v-for="(status, task) in assignment.progress"
            :key="task"
            class="flex justify-between text-sm align-items-center"
          >
            <div>{{ taskDisplayNames[task]?.publicName }}</div>
            <div>
              <PvTag
                :severity="progressTags[_capitalize(status)]?.severity"
                :value="progressTags[_capitalize(status)]?.value"
                :icon="progressTags[_capitalize(status)]?.icon"
                class="p-0.5 m-0 font-semibold capitalize"
                :style="`min-width: 2rem;`"
                rounded
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { taskDisplayNames, progressTags } from '@/helpers/reports.js';
import _capitalize from 'lodash/capitalize';
import PvTag from 'primevue/tag';
import PvButton from 'primevue/button';

import { getGradeToDisplay } from '@/helpers/reports.js';

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
