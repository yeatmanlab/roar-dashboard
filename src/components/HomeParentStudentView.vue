[
<template>
  <div class="text-2xl font-bold text-gray-600">
    <div
      v-if="isLoadingAssignments || isLoadingAdministrations"
      class="flex flex-column items-center justify-content-center w-full text-center"
    >
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Loading Assignments</div>
    </div>
    <div
      v-else-if="!parentRegistrationComplete"
      class="flex flex-column items-center justify-content-center w-full text-center"
    >
      <div>
        <AppSpinner class="mb-4" />
      </div>
      <div class="w-64 text-lg font-light">Administration enrollment in progress</div>
    </div>
    <div v-else-if="registrationError?.length > 0" class="p-3">
      <PvMessage severity="error">
        <div class="text-lg font-bold text-gray-600">Error while fetching registrations status:</div>
        <div class="text-sm font-light text-gray-800">{{ registrationError }}</div>
      </PvMessage>
    </div>
    <div v-else-if="assignmentData?.length == 0" class="p-3">
      <PvMessage severity="info">
        <div class="text-lg font-bold text-gray-600">No assignments available</div>
        <div class="text-sm font-light text-gray-800">Please check back later.</div>
      </PvMessage>
    </div>
    <div v-else class="flex flex-row align-items-center justify-content-center w-full flex-wrap">
      <div v-for="assignment in assignmentData" :key="assignment.id" class="flex items-center">
        <StudentCard
          :assignment="assignment"
          :org-type="orgType"
          :org-id="orgId"
          :administration-id="administrationId"
        />
      </div>
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
  isLoadingAssignments: {
    type: Boolean,
    required: true,
  },
  isLoadingAdministrations: {
    type: Boolean,
    required: true,
  },
  parentRegistrationComplete: {
    type: Boolean,
    required: true,
  },
  assignmentData: {
    type: Array,
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
  },
});
</script>
