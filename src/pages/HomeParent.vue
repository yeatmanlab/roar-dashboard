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
      <div class="flex flex-row">
        <div v-if="assignmentData.length == 0">
          <div class="text-lg font-bold text-gray-600">No assignments available</div>
          <div class="text-sm font-light text-gray-800">Please check back later.</div>
        </div>
        <div v-for="assignment in assignmentData" :key="assignment.id">
          <UserCard
            :assignment="assignment"
            :org-type="orgType"
            :org-id="orgId"
            :administration-id="administrationId"
          />
        </div>
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
import { pluralizeFirestoreCollection } from '@/helpers';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes.js';

const initialized = ref(true);
const administrationId = ref(null);
// TODO: Set this dynamically in cases where this component is used for non-family adminstrators
const orgType = ref(SINGULAR_ORG_TYPES.FAMILIES);
const orgId = ref(null);

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
      // sets administrationId from administrationsListQuery, defaulting to the first administration return
      // ROAR@Home families should only have one administration at most (?)
      // TODO: Determine a more robust/dynamic method to toggle between administrations
      administrationId.value = updatedAdministrationsData[0].id;
    }
  },
  { immediate: true },
);
const { data: userClaims } = useUserClaimsQuery();

watch(
  userClaims,
  (updatedUserClaims) => {
    // sets orgId from the user's adminOrgs families array, defaulting to the first family in the collection
    // TODO: Determine a more robust/dynamic method to return orgId
    if (!updatedUserClaims) return;
    orgId.value = updatedUserClaims?.claims?.adminOrgs[pluralizeFirestoreCollection(orgType.value)][0];
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
