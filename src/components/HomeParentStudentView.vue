[
<template>
  <div class="text-2xl font-bold text-gray-600">
    <div v-if="isLoading" class="flex items-center w-full text-center flex-column justify-content-center">
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Loading Assignments</div>
    </div>

    <div
      v-else-if="!parentRegistrationComplete"
      class="flex items-center w-full text-center flex-column justify-content-center"
    >
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Administration enrollment in progress</div>
    </div>

    <div v-else-if="registrationError?.length < 0" class="p-3">
      <PvMessage severity="error">
        <div class="text-lg font-bold text-gray-600">Error while fetching registrations status:</div>
        <div class="text-sm font-light text-gray-800">{{ registrationError }}</div>
      </PvMessage>
    </div>

    <div v-else-if="Object.keys(childrenAssignments).length === 0" class="p-3">
      <PvMessage severity="info">
        <div class="text-lg font-bold text-gray-600">No assignments available</div>
        <div class="text-sm font-light text-gray-800">Please check back later.</div>
      </PvMessage>
    </div>

    <div
      v-else
      class="grid flex-wrap grid-cols-1 gap-4 w-full"
      :class="{
        'lg:grid-cols-2': Object.keys(childrenAssignments).length === 2,
        'lg:grid-cols-2 2xl:grid-cols-3': Object.keys(childrenAssignments).length === 3,
        'lg:grid-cols-4': Object.keys(childrenAssignments).length === 4,
      }"
    >
      <template v-for="(assignments, userId) in childrenAssignments" :key="userId">
        <StudentCard
          :assignments="assignments"
          :user-id="userId"
          :org-type="orgType"
          :org-id="orgId"
          :administration-id="administrationId"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import AppSpinner from '@/components/AppSpinner.vue';
import StudentCard from '@/components/StudentCard.vue';
import PvMessage from 'primevue/message';

defineOptions({
  name: 'HomeParentStudentView',
});

defineProps({
  isLoading: {
    type: Boolean,
    required: true,
  },
  parentRegistrationComplete: {
    type: Boolean,
    required: true,
  },
  childrenAssignments: {
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
  administrationId: {
    type: String,
    required: true,
  },
  registrationError: {
    type: String,
    required: false,
    default: '',
  },
});
</script>

<style>
.grid {
  display: grid !important;
  margin: 0 !important;
}

@media (min-width: 1024px) {
  .grid > * {
    max-width: 575px;
    width: 100%;
  }
}
</style>
