<template>
  <div>
    <div
      v-if="!initialized || isLoading || isFetching"
      class="flex flex-column align-items-center justify-content-center min-h-screen-minus-nav"
      data-cy="home-participant__administration-loadingstate"
    >
      <AppSpinner style="margin-bottom: 1rem" />
      <span>{{ $t('homeParticipant.loadingAssignments') }}</span>
    </div>

    <div
      v-else-if="!hasAssignments"
      class="flex align-items-center justify-content-center min-h-screen-minus-nav"
      data-cy="home-participant__administration-emptystate"
    >
      <AppMessageState
        :type="MESSAGE_STATE_TYPES.EMPTY"
        :title="$t('homeParticipant.noAssignments')"
        :message="$t('homeParticipant.contactAdministrator')"
      >
        <template #actions>
          <PvButton :label="$t('navBar.signOut')" icon="pi pi-sign-out" @click="signOut" />
        </template>
      </AppMessageState>
    </div>

    <div v-else data-cy="home-participant__administration">
      <div v-if="props.launchId" class="flex items-center p-2 bg-gray-100 w-100 justify-content-center">
        <div class="text-lg font-bold text-gray-600" data-cy="participant-launch-mode">
          Currently in <span class="mr-4 text-red-700"> external launch mode </span>
          <router-link to="/">
            <PvButton>
              <i class="pi pi-arrow-left"></i>
              Exit student mode</PvButton
            >
          </router-link>
        </div>
      </div>
      <PvFloatLabel>
        <h2 v-if="userAssignments?.length == 1" class="dropdown-container">
          {{ userAssignments.at(0).publicName || userAssignments.at(0).name }}
        </h2>
      </PvFloatLabel>
      <div class="flex flex-row gap-2 ml-5 align-items-end justify-content-between">
        <PvFloatLabel class="mt-3 mr-3">
          <div v-if="userAssignments?.length > 0" class="flex flex-row mt-4 w-full align-items-start">
            <div class="assignment-select-container">
              <div class="flex w-full align-content-start">
                <PvSelect
                  v-model="selectedAdmin"
                  :options="sortedUserAdministrations ?? []"
                  :option-label="getOptionLabel"
                  input-id="dd-assignment"
                  data-cy="dropdown-select-administration"
                  :pt="{ optionLabel: { 'data-testid': 'select__option-label' } }"
                  @change="toggleShowOptionalAssessments"
                />
                <label for="dd-assignment" class="mt-4">{{ $t('homeParticipant.selectAssignment') }}</label>
              </div>
            </div>
          </div>
        </PvFloatLabel>
        <div
          v-if="optionalAssessments.length !== 0"
          class="flex flex-row gap-2 mr-6 switch-container align-items-center justify-content-end"
        >
          <PvToggleSwitch
            v-model="showOptionalAssessments"
            input-id="switch-optional"
            data-cy="switch-show-optional-assessments"
          />
          <label for="switch-optional" class="mr-2 text-gray-500">{{
            $t('homeParticipant.showOptionalAssignments')
          }}</label>
        </div>
      </div>
      <div class="tabs-container">
        <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" :student-info="studentInfo" />
        <Transition name="fade" mode="out-in">
          <GameTabs
            v-if="canShowAssessments && showOptionalAssessments && userData"
            :games="optionalAssessments"
            :sequential="isSequential"
            :user-data="userData"
            :launch-id="launchId"
          />
          <GameTabs
            v-else-if="canShowAssessments && requiredAssessments && userData"
            :games="requiredAssessments"
            :sequential="isSequential"
            :user-data="userData"
            :launch-id="launchId"
          />
        </Transition>
      </div>
    </div>
  </div>

  <ConsentModal
    v-if="showConsent"
    :consent-text="confirmText"
    :consent-type="consentType"
    :on-confirm="updateConsent"
  />
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import _filter from 'lodash/filter';
import _isEmpty from 'lodash/isEmpty';
import { storeToRefs } from 'pinia';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvToggleSwitch from 'primevue/toggleswitch';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useMeQuery from '@/composables/queries/useMeQuery';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserAdministrationsQuery from '@/composables/queries/useUserAdministrationsQuery';
import useAdministrationAgreementsQuery from '@/composables/queries/useAdministrationAgreementsQuery';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useUpdateConsentMutation from '@/composables/mutations/useUpdateConsentMutation';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import { AppMessageState, MESSAGE_STATE_TYPES } from '@/components/AppMessageState';
import AppSpinner from '@/components/AppSpinner.vue';
import { mapAdministrationTasksToGames } from '@/helpers/participantGames';
import { resolveConsentRequirement, CONSENT_REQUIREMENT_STATUS } from '@/helpers/resolveConsentRequirement';

const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const consentType = ref('');
const consentParams = ref({});

const props = defineProps({
  launchId: {
    type: String,
    required: false,
    default: null,
  },
});

const { mutateAsync: updateConsentStatus } = useUpdateConsentMutation();
const { mutate: signOut } = useSignOutMutation();

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { roarfirekit, showOptionalAssessments } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig?.()) init();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig?.()) {
    init();
  }
});

const getOptionLabel = computed(() => {
  return (option) => {
    // Check if 'name' exists, otherwise fallback to 'publicName' or 'id'
    return option.publicName || option.name || option.id || '';
  };
});

const gameStore = useGameStore();
const { selectedAdmin } = storeToRefs(gameStore);

const {
  isLoading: isLoadingUserData,
  isFetching: isFetchingUserData,
  data: userData,
} = useUserDataQuery(props.launchId, {
  enabled: initialized,
});

// Resolve the student's ROAR (Postgres) user ID from the backend `/me` endpoint,
// the same way the Task players do. This is the identity the new
// `GET /users/:userId/administrations` endpoint expects — NOT the Firebase
// `roarUid`.
//
// NOTE: In proxy-launch mode (`props.launchId` set), `me.id` is the launching
// user's ID, not the participant's. Resolving the participant's UUID from the
// launch record is not yet implemented (mirrors the documented limitation in
// the Task players). The standard student homepage path is unaffected.
const { data: me } = useMeQuery({ enabled: initialized });
const userId = computed(() => me.value?.id);

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: userAssignments,
} = useUserAdministrationsQuery(userId, {
  enabled: initialized,
});

const sortedUserAdministrations = computed(() => {
  return [...(userAssignments.value ?? [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
});

// The selected administration's required consent/assent agreements. This is the
// signal that drives the consent gate after the Firestore-assignment migration:
// the deprecated `selectedAdmin.legal` block is gone, so which document the
// administration requires (if any) now comes from
// `GET /administrations/:id/agreements`.
const selectedAdminId = computed(() => selectedAdmin.value?.id);

const { data: administrationAgreements, isSuccess: isAgreementsSuccess } = useAdministrationAgreementsQuery(
  selectedAdminId,
  {
    enabled: initialized,
  },
);

// The agreements requirement is "resolved" only when the query has succeeded for
// the currently selected administration. While it is loading or errored we must
// treat consent as UNRESOLVED and block the student rather than proceeding as if
// no consent were required. `isSuccess` already excludes the error state (the two
// are mutually exclusive in TanStack Query), so checking it alone is sufficient.
const isAgreementsResolved = computed(() => isAgreementsSuccess.value);

// Tracks whether the consent gate has been evaluated to a definitive outcome
// (either "not required" or "required + decision made") for the current
// selection. It starts false and is only set true once `checkConsent()` reaches
// a resolved branch, so the game list stays gated until the consent requirement
// is known. Reset to false whenever the selected administration changes.
const isConsentResolved = ref(false);

// The task catalog supplies presentational fields (name, description, image,
// tutorial video, external/URL config) keyed by the task's UUID `id` or `slug`.
// The administration tasks carry the per-student `optional`/`assigned`/`progress`
// state, so we only need the catalog for display data.
const {
  isLoading: isLoadingTasks,
  isFetching: isFetchingTasks,
  data: tasks,
} = useTasksQuery({
  enabled: initialized,
});

const isLoading = computed(() => {
  return isLoadingUserData.value || isLoadingAssignments.value || isLoadingTasks.value;
});

const isFetching = computed(() => {
  return isFetchingUserData.value || isFetchingAssignments.value || isFetchingTasks.value;
});

const hasAssignments = computed(() => {
  if (isLoading.value || isFetching.value) return false;
  return assessments.value.length > 0;
});

/**
 * Evaluate, and apply, the consent/assent gate for the selected administration.
 *
 * The requirement is driven by the administration's agreements
 * (`useAdministrationAgreementsQuery`) — the deprecated `selectedAdmin.legal`
 * block no longer exists. The student's signed status is still read from, and
 * written back to, Firestore (`userData.legal` + `useUpdateConsentMutation`), so
 * the document fetch, the signed-status read, and the consent write all key off
 * the same agreement `name`.
 *
 * Compliance behavior:
 * - While the agreements query is unresolved (loading/errored), consent is
 *   UNRESOLVED: `isConsentResolved` stays false so the game list remains gated.
 *   We never fall through to "no consent needed" with an unknown requirement.
 * - The gate SHOWS whenever the student has not signed the current version and
 *   is old enough — regardless of the now-absent amount/expectedTime fields.
 */
async function checkConsent() {
  // Close the gate for the duration of the (async) evaluation so the game list
  // is never visible while consent is being (re-)checked. It is only re-opened
  // below once a definitive resolved branch is reached.
  isConsentResolved.value = false;

  // Until the agreements requirement resolves, leave the student gated.
  if (!isAgreementsResolved.value) {
    return;
  }

  const decision = await resolveConsentRequirement({
    agreements: administrationAgreements.value,
    agreementsResolved: isAgreementsResolved.value,
    userData: userData.value,
    getLegalDoc: (docName) => authStore.getLegalDoc(docName),
  });

  // The legal document could not be resolved (e.g. getLegalDoc returned null or
  // threw). Treat as unresolved and keep the student gated rather than skipping.
  if (decision.status === CONSENT_REQUIREMENT_STATUS.UNRESOLVED) {
    isConsentResolved.value = false;
    return;
  }

  if (decision.status === CONSENT_REQUIREMENT_STATUS.NOT_REQUIRED) {
    // Always show consent form for this test student when running Cypress tests
    // @TODO: Remove this once we update the E2E tests to handle the consent form without persisting state. This would
    // improve the test relability as enforcing the below condition defeats parts of the test purpose.
    if (userData.value?.id === 'O75V6IcVeiTwW8TRjXb76uydlwV2') {
      consentType.value = 'consent';
      confirmText.value = 'This is a test student. Please do not accept this form.';
      showConsent.value = true;
    }
    isConsentResolved.value = true;
    return;
  }

  // decision.status === REQUIRED
  consentType.value = decision.consentType;
  consentVersion.value = decision.consentVersion;

  if (decision.shouldShow) {
    confirmText.value = decision.consentText;
    showConsent.value = true;
  }

  isConsentResolved.value = true;
}

async function updateConsent() {
  consentParams.value = {
    // The legacy `amount` / `expectedTime` fields are not carried by the
    // agreements endpoint. They are recorded as metadata only; their absence
    // must never suppress the gate (the gate decision in `checkConsent` does not
    // depend on them).
    dateSigned: new Date(),
  };

  await updateConsentStatus({
    consentType,
    consentVersion,
    consentParams,
  });
}

const toggleShowOptionalAssessments = async () => {
  await checkConsent();
  showOptionalAssessments.value = null;
};

// Games to populate the game tabs, derived from the selected administration's tasks.
//
// The backend computes `optional`, `assigned`, and `progress` for the target
// student and attaches them to each task, so the homepage maps them straight
// through (see mapAdministrationTasksToGames) — there is no client-side
// condition evaluation or cross-assignment merge. Tasks with `assigned: false`
// are in the administration but not assigned to this student, so they are
// filtered out and don't appear on the homepage.
const assessments = computed(() => {
  if (isFetching.value || !selectedAdmin.value) return [];
  return mapAdministrationTasksToGames(selectedAdmin.value, tasks.value);
});

const requiredAssessments = computed(() => {
  return _filter(assessments.value, (assessment) => !assessment.optional);
});

const optionalAssessments = computed(() => {
  return _filter(assessments.value, (assessment) => assessment.optional);
});

// Hard gate for the assessment list: the student may only reach the games once
// the consent requirement has resolved AND no consent/assent form is pending.
// While the agreements query is loading/errored (`isConsentResolved` false) or
// the consent modal is showing, the game list is withheld so the student cannot
// start an assessment without satisfying consent. Fail toward withholding.
const canShowAssessments = computed(() => isConsentResolved.value && !showConsent.value);

// Tasks must be completed sequentially when the administration is ordered.
const isSequential = computed(() => {
  return selectedAdmin.value?.isOrdered ?? true;
});

// Total games completed from the current list of assessments
let totalGames = computed(() => {
  return requiredAssessments.value.length ?? 0;
});

// Total games included in the current assessment
let completeGames = computed(() => {
  return _filter(requiredAssessments.value, (task) => task.completedOn).length ?? 0;
});

// Set up studentInfo for sidebar
const studentInfo = computed(() => {
  return {
    grade: userData.value?.studentData?.grade,
  };
});

watch(
  [userData, selectedAdmin, userAssignments],
  async () => {
    // If the assignments are still loading, abort.
    if (isLoadingAssignments.value || isFetchingAssignments.value || !userAssignments.value?.length) return;

    const allAdminIds = userAssignments.value?.map((administration) => administration.id) ?? [];

    // Verify that we have a selected administration and it is in the list of all assigned administrations.
    if (selectedAdminId.value && allAdminIds.includes(selectedAdminId.value)) {
      // Ensure that the selected administration is a fresh instance of the administration. Whilst this seems redundant,
      // this is apparently relevant in the case that the game store does not flush properly.
      selectedAdmin.value = sortedUserAdministrations.value.find(
        (administration) => administration.id === selectedAdminId.value,
      );

      return;
    }

    // Otherwise, choose the first sorted administration if there is no selected administration.
    selectedAdmin.value = sortedUserAdministrations.value[0];
  },
  { immediate: true },
);

// Consent gate evaluation. Kept separate from the administration-selection
// bookkeeping above because the consent requirement depends on the
// per-administration agreements query, which refetches whenever the selected
// administration changes. Re-running here when the agreements (re)resolve — and
// resetting the gate the moment the selection changes — guarantees the student
// is never treated as consent-free during the window between selecting an
// administration and its agreements loading.
watch(
  [userData, selectedAdminId, administrationAgreements, isAgreementsResolved],
  async ([newUserData], [, previousSelectedAdminId] = []) => {
    // A new administration was selected: re-gate until the new administration's
    // requirement resolves.
    if (selectedAdminId.value !== previousSelectedAdminId) {
      isConsentResolved.value = false;
    }

    // Re-derive the gate from scratch on every relevant change: close any open
    // modal first, then let `checkConsent()` re-open it only if still required.
    // This is what clears the modal after the student accepts (the consent write
    // invalidates `userData`, which re-runs this watcher) without a separate
    // "modal accepted" signal — mirroring the pre-migration reset.
    showConsent.value = false;

    if (_isEmpty(newUserData) || !selectedAdminId.value) return;

    await checkConsent();
  },
  { immediate: true },
);
</script>
<style scoped>
.tabs-container {
  display: flex;
  flex-direction: row;
  max-width: 100vw;
  padding: 2rem;
  gap: 2rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dropdown-container {
  margin-top: 2rem;
  margin-left: 2rem;
}

.assignment-select-container {
  min-width: 100%;
}

.switch-container {
  min-width: 24%;
}

@media screen and (max-width: 1100px) {
  .tabs-container {
    flex-direction: row;
  }
}
</style>
