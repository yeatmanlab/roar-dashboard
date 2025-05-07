<!-- component for parent view - cards  -->

<template>
  <!-- default to showing students from the first administration -->
  <div class="flex flex-column m-4 gap-2">
    <div class="flex align-items-center justify-content-between p-4">
      <div class="flex flex-column">
        <div class="text-2xl font-bold text-gray-600">Parent Dashboard</div>
        <div class="text-sm font-light text-gray-800">Manage your children and view their assessments.</div>
      </div>

      <div class="flex flex-row align-items-center gap-4">
        <div class="uppercase text-sm text-gray-600 flex flex-row">VIEW BY</div>
        <PvSelectButton
          v-model="parentView"
          :options="parentViews"
          option-disabled="constant"
          :allow-empty="false"
          option-label="name"
          class="flex my-2 select-button"
          @change="handleViewChange"
        >
        </PvSelectButton>
      </div>
    </div>
    <HomeParentStudentView
      v-if="parentView.name === 'Student'"
      :is-loading-assignments="isLoadingAssignments"
      :is-loading-administrations="isLoadingAdministrations"
      :parent-registration-complete="parentRegistrationComplete"
      :assignment-data="assignmentData || []"
      :org-type="orgType"
      :org-id="orgId"
      :administration-id="administrationId"
    />
    <div v-else class="home-administrator-wrapper">
      <HomeAdministrator />
    </div>
  </div>
</template>

<style scoped>
.home-administrator-wrapper :deep(.main) {
  padding: 0;
  width: 90vw;
}
</style>

<script setup>
import useAdministrationsListQuery from '@/composables/queries/useAdministrationsListQuery';
import useAdministrationAssignmentsQuery from '@/composables/queries/useAdministrationAssignmentsQuery';
import { orderByDefault } from '@/helpers/query/utils';
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { pluralizeFirestoreCollection } from '@/helpers';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes.js';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import PvSelectButton from 'primevue/selectbutton';
import HomeAdministrator from '@/pages/HomeAdministrator.vue';
import HomeParentStudentView from '@/components/HomeParentStudentView.vue';

const authStore = useAuthStore();

const parentView = ref({ name: 'Student', constant: false });
const parentViews = [
  { name: 'Student', constant: false },
  { name: 'Administration', constant: false },
];

const parentRegistrationComplete = ref(false);
const initialized = ref(false);
const administrationId = ref(null);
// TODO: Set this dynamically in cases where this component is used for non-family adminstrators
const orgType = ref(SINGULAR_ORG_TYPES.FAMILIES);
const orgId = ref(null);

const orderBy = ref(orderByDefault);
const { isLoading: isLoadingAdministrations, data: administrations } = useAdministrationsListQuery(orderBy, false, {
  enabled: initialized,
});

let unsubscribeInitializer;
const init = () => {
  if (unsubscribeInitializer) unsubscribeInitializer();
};

unsubscribeInitializer = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

let parentRegistrationTimer = undefined;

onMounted(async () => {
  if (authStore.isAuthenticated) {
    // check first if initialized value in userStore is true, if so, registration is complete
    if (authStore.userData.initialized || !authStore.userData.registrations) {
      parentRegistrationComplete.value = true;
      initialized.value = true;
    } else {
      parentRegistrationTimer = setInterval(async function () {
        console.log('calling parentRegistrationTimer');
        // Poll for the preload trials progress bar to exist and then begin the game
        parentRegistrationComplete.value = await authStore.verifyParentRegistration();
        // if parentRegistration has completed, break out of the loop
        if (parentRegistrationComplete.value) {
          initialized.value = true;
          console.log('parent registration complete');
          clearInterval(parentRegistrationTimer);
        }
      }, 5000);
    }
  }
});

onBeforeUnmount(() => {
  if (parentRegistrationTimer) {
    clearInterval(parentRegistrationTimer);
  }
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
