<!-- component for parent view - cards  -->

<template>
  <!-- default to showing students from the first administration -->

  <div class="flex flex-column m-4 gap-2">
    <div class="flex flex-column">
      <div class="text-2xl font-bold text-gray-600">Parent Dashboard</div>
      <div class="text-sm font-light text-gray-800">Manage your children and view their assessments.</div>
    </div>
    <div class="text-2xl font-bold text-gray-600">
      <div v-if="isLoadingAssignments || isLoadingAdministrations">
        <AppSpinner class="mb-4" />
      </div>
      <div v-for="assignment in assignmentData" v-else :key="assignment.id">
        <UserCard :assignment="assignment" />
      </div>
    </div>
  </div>
</template>

<script setup>
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import useAdministrationAssignmentsQuery from '@/composables/queries/useAdministrationAssignmentsQuery';
import { orderByDefault } from '@/helpers/query/utils';
import { ref, watch } from 'vue';
import UserCard from '@/components/UserCard.vue';

const initialized = ref(true);
const administrationId = ref(null);
const orgType = ref('group');
const orgId = ref('au2ZfKdfanIgQDn6WVtp');

const orderBy = ref(orderByDefault);
const { isLoading: isLoadingAdministrations, data: administrations } = useAdministrationsListQuery(orderBy, false, {
  enabled: initialized,
});

watch(
  administrations,
  (updatedAdministrationsData) => {
    if (!updatedAdministrationsData) return;
    // set administrationId, orgType, and orgId to first administration
    if (updatedAdministrationsData.length > 0) {
      console.log('update admindata', updatedAdministrationsData);
      administrationId.value = updatedAdministrationsData[0].id;
    }
  },
  { immediate: true },
);

const { isLoading: isLoadingAssignments, data: assignmentData } = useAdministrationAssignmentsQuery(
  administrationId,
  orgType,
  orgId,
  {
    enabled: initialized,
  },
);
</script>
