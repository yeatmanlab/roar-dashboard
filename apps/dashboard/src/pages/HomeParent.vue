<template>
  <main class="container p-4" data-cy="parent-homepage">
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
      :is-loading="isLoadingUserData"
      :parent-registration-complete="parentRegistrationComplete"
      :family-id="familyId"
      :children-uids="childrenUids"
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
import { ref, computed } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import PvSelectButton from 'primevue/selectbutton';
import HomeAdministrator from '@/pages/HomeAdministrator.vue';
import HomeParentStudentView from '@/components/HomeParentStudentView.vue';
import useMeQuery from '@/composables/queries/useMeQuery';
import useFamilyUsersQuery from '@/composables/queries/useFamilyUsersQuery';
import { SINGULAR_ORG_TYPES } from '@/constants/orgTypes.js';
import { FAMILY_USERS_QUERY_KEY, ME_QUERY_KEY } from '@/constants/queryKeys';

const VIEWS = Object.freeze({
  BY_STUDENT: 'Student',
  BY_ASSIGNMENT: 'Assignment',
});

const currentParentView = ref({ name: VIEWS.BY_STUDENT });
const parentViews = [{ name: VIEWS.BY_STUDENT }, { name: VIEWS.BY_ASSIGNMENT }];

// The caretaker's identity and family memberships come from the backend `/me`
// endpoint — no Firestore user document and no firekit registration polling.
const { data: me, isLoading: isLoadingMe } = useMeQuery();

// The parent dashboard is scoped to the family the caller is a `parent` of. A
// ROAR@Home child is also a family member (role `child`); filtering on the
// `parent` role distinguishes the caretaker's own family. The role strings are
// the contract's UserFamilyRoleSchema values (`'parent' | 'child'`).
const familyId = computed(() => me.value?.families?.find((family) => family.role === 'parent')?.id ?? null);

// A caretaker who has a parent family is fully registered. The family is created
// synchronously during registration (the family-registration saga), so there is
// no eventual-consistency window to poll for as there was with firekit.
const parentRegistrationComplete = computed(() => Boolean(familyId.value));

// The family is the org context for the parent dashboard. `orgType` is constant;
// `orgId` is the family UUID once `/me` resolves.
const orgType = SINGULAR_ORG_TYPES.FAMILIES;
const orgId = computed(() => familyId.value);

// The family's children, listed from `GET /v1/families/:familyId/users` filtered
// to the `child` role. Each child's `id` is the ROAR (Postgres) UUID that the
// per-user endpoints (and StudentCardSimple) key on — not a Firebase UID.
const {
  data: children,
  isLoading: isLoadingChildren,
  error: childrenError,
} = useFamilyUsersQuery(familyId, { role: 'child' });

const childrenUids = computed(() => (children.value ?? []).map((child) => child.id));

// "Loading" until `/me` resolves, and — once a family is known — until its
// children resolve.
const isLoadingUserData = computed(() => isLoadingMe.value || (Boolean(familyId.value) && isLoadingChildren.value));

const registrationError = computed(() => childrenError.value ?? null);

const queryClient = useQueryClient();

// After a child is enrolled, refetch the family children (and `/me`, in case the
// membership set changed) so the new card appears. The add-children mutation
// already invalidates these keys; this keeps the explicit refresh contract with
// the student view.
const handleRefreshRegistration = () => {
  queryClient.invalidateQueries({ queryKey: [FAMILY_USERS_QUERY_KEY] });
  queryClient.invalidateQueries({ queryKey: [ME_QUERY_KEY] });
};
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
