<template>
  <main class="container p-4">
    <div class="flex mb-4 align-items-center justify-content-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-600">Parent Dashboard</h1>
        <div class="text-sm font-light text-gray-800">Manage your children and view their assessments.</div>
      </div>

      <div class="flex flex-row gap-4 align-items-center">
        <div class="flex flex-row text-sm text-gray-600 uppercase">View by</div>
        <PvSelectButton
          v-model="currentParentView"
          :options="parentViews"
          option-disabled="constant"
          :allow-empty="false"
          option-label="name"
          class="flex my-2"
        >
        </PvSelectButton>
      </div>
    </div>

    <HomeParentStudentView
      v-if="currentParentView.name === VIEWS.BY_STUDENT"
      :is-loading="isLoadingAdministrations || isLoadingChildrenAssignments"
      :parent-registration-complete="parentRegistrationComplete"
      :children-assignments="childrenAssignments || []"
      :org-type="orgType"
      :org-id="orgId"
      :registration-error="registrationError"
      @refresh-registration="handleRefreshRegistration"
    />

    <div v-else class="home-administrator-wrapper">
      <HomeAdministrator />
    </div>
  </main>
</template>

<script setup>
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';
import useMultipleUserAssignmentsQuery from '@/composables/queries/useMultipleUserAssignmentsQuery';
import { useTimeoutPoll } from '@vueuse/core';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { pluralizeFirestoreCollection } from '@/helpers';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes.js';
import { useAuthStore } from '@/store/auth';
import PvSelectButton from 'primevue/selectbutton';
import HomeAdministrator from '@/pages/HomeAdministrator.vue';
import HomeParentStudentView from '@/components/HomeParentStudentView.vue';

const authStore = useAuthStore();

const VIEWS = Object.freeze({
  BY_STUDENT: 'Student',
  BY_ASSIGNMENT: 'Assignment',
});

const currentParentView = ref({ name: VIEWS.BY_STUDENT });

const parentViews = [{ name: VIEWS.BY_STUDENT }, { name: VIEWS.BY_ASSIGNMENT }];
const { data: userClaims } = useUserClaimsQuery();

// Parent registration status
const parentRegistrationComplete = ref(false);
const initialized = ref(false);
const orgId = computed(() => {
  const adminOrgs = userClaims.value?.claims?.adminOrgs ?? {};
  const orgTypePluralized = pluralizeFirestoreCollection(orgType.value);
  const orgTypeOrganizations = adminOrgs[orgTypePluralized] ?? [];

  return orgTypeOrganizations[0] ?? null;
});

const orgIds = computed(() => (orgId.value ? [orgId.value] : []));

// TODO: Set this dynamically in cases where this component is used for non-family adminstrators
const orgType = ref(SINGULAR_ORG_TYPES.FAMILIES);

// Get assignments for all children
const childrenUids = computed(() => {
  const uids = authStore.userData?.childrenUids || [];
  return uids;
});

const { data: childrenAssignments, isLoading: isLoadingChildrenAssignments } = useMultipleUserAssignmentsQuery(
  childrenUids,
  orgType,
  orgIds,
);

const registrationError = ref(null);
const registrationRetryCount = ref(0);
const MAX_RETRIES = 3;
// Handler for refreshing registration status after student enrollment
const handleRefreshRegistration = () => {
  registrationRetryCount.value = 0;
  resume();
};

const { isActive, pause, resume } = useTimeoutPoll(
  async () => {
    try {
      parentRegistrationComplete.value = await authStore.verifyParentRegistration();

      if (parentRegistrationComplete.value) {
        initialized.value = true;
        registrationError.value = null;
        pause();
      }
    } catch (error) {
      console.error('Registration verification failed:', error);
      registrationRetryCount.value++;

      if (registrationRetryCount.value >= MAX_RETRIES) {
        console.error('Registration verification failed, maximum retries reached:', error);
        registrationError.value = error;
        pause();
      }
    }
  },
  5000,
  { immediate: false },
);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;

  // Only start polling if registration check is needed
  if (!authStore.userData?.initialized && authStore.userData?.registrations) {
    resume();
  }
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(() => {
  if (authStore.roarfirekit.restConfig?.()) init();

  // Set registration complete if already initialized
  if (authStore.userData?.initialized || !authStore.userData?.registrations) {
    parentRegistrationComplete.value = true;
  }
});

onBeforeUnmount(() => {
  if (isActive.value) pause();
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
/* @TODO: Remove once the administrations views is decoupled from the Administrator homepage */
.home-administrator-wrapper {
  padding: 1.5rem;
}
.home-administrator-wrapper :deep(.main) {
  padding: 0;
  width: 100%;
}
</style>
