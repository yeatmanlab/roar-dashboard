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
            v-if="canShowAssessments && showOptionalAssessments && participantData"
            :games="optionalAssessments"
            :sequential="isSequential"
            :user-data="participantData"
            :launch-id="launchId"
          />
          <GameTabs
            v-else-if="canShowAssessments && requiredAssessments && participantData"
            :games="requiredAssessments"
            :sequential="isSequential"
            :user-data="participantData"
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
import { useQueryClient } from '@tanstack/vue-query';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvToggleSwitch from 'primevue/toggleswitch';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useMeQuery from '@/composables/queries/useMeQuery';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import useUserMembershipsQuery from '@/composables/queries/useUserMembershipsQuery';
import useUserAdministrationsQuery from '@/composables/queries/useUserAdministrationsQuery';
import useUserAdministrationAgreementsQuery from '@/composables/queries/useUserAdministrationAgreementsQuery';
import useAgreementVersionContentQuery from '@/composables/queries/useAgreementVersionContentQuery';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useRecordUserAgreementMutation from '@/composables/mutations/useRecordUserAgreementMutation';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import { AppMessageState, MESSAGE_STATE_TYPES } from '@/components/AppMessageState';
import AppSpinner from '@/components/AppSpinner.vue';
import { mapAdministrationTasksToGames, gameNeedsOrgMemberships } from '@/helpers/participantGames';
import { resolveConsentRequirement, CONSENT_REQUIREMENT_STATUS } from '@/helpers/resolveConsentRequirement';
import { USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY } from '@/constants/queryKeys';

const showConsent = ref(false);
const confirmText = ref('');
const consentType = ref('');

// The agreement + current version the gate is currently asking the student to
// sign. Both must refer to the SAME version the gate checked: the content query
// fetches this version's text, and the record mutation records acceptance of
// this exact version.
const consentAgreementId = ref(null);
const consentVersionId = ref(null);

const props = defineProps({
  launchId: {
    type: String,
    required: false,
    default: null,
  },
});

const queryClient = useQueryClient();
const { mutateAsync: recordUserAgreement } = useRecordUserAgreementMutation();
const { mutate: signOut } = useSignOutMutation();

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { showOptionalAssessments } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.accessToken) init();
});

onMounted(async () => {
  if (authStore.isAuthReady) {
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

// Resolve the participant's ROAR (Postgres) user ID from the backend `/me`
// endpoint. This is the identity the backend user, administrations, and
// agreements endpoints expect — NOT the Firebase `roarUid`.
//
// NOTE: In proxy-launch mode (`props.launchId` set), `me.id` is the launching
// user's ID, not the participant's. Resolving the participant's UUID for the
// proxy path is handled by the separate proxy-launch change; the standard
// student homepage path is unaffected.
const { data: me } = useMeQuery({ enabled: initialized });
const userId = computed(() => me.value?.id);

// Participant profile from the backend (`GET /users/:id` → `mapUser`), replacing
// the Firestore user-doc read — the last Firestore read on this page. Pass the
// resolved Postgres `userId` (not `props.launchId`) and gate on it:
// `useUserStudentDataQuery` falls back to the Firestore `roarUid` for a falsy
// arg, which the backend would 404 on, so the query stays disabled until the
// Postgres id is known.
const {
  isLoading: isLoadingUserData,
  isFetching: isFetchingUserData,
  data: userData,
} = useUserStudentDataQuery(userId, {
  enabled: computed(() => initialized.value && Boolean(userId.value)),
});

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

// The selected administration's required consent/assent agreements, annotated
// with this student's server-computed signed status. This is the signal that
// drives the consent gate fully off the backend: which document the
// administration requires (if any) and whether the student has signed the
// current version both come from
// `GET /users/:userId/administrations/:administrationId/agreements`. There is no
// firekit `getLegalDoc`, no `userData.legal` read, no agreement-name→Firestore
// mapping, and no client-side renewal-date logic.
const selectedAdminId = computed(() => selectedAdmin.value?.id);

const { data: administrationAgreements, isSuccess: isAgreementsSuccess } = useUserAdministrationAgreementsQuery(
  userId,
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

// The consent/assent document text for the gate. Fetched reactively for the
// agreement + current version the gate selected (`consentAgreementId` /
// `consentVersionId`), so the modal renders the exact version's content that the
// student will be recorded as accepting. The query is internally gated on both
// IDs being present, so it stays idle until `checkConsent()` selects an
// agreement to show.
const { data: consentContent, isError: isConsentContentError } = useAgreementVersionContentQuery(
  consentAgreementId,
  consentVersionId,
);

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
 * The requirement AND the student's signed status both come from the backend
 * (`useUserAdministrationAgreementsQuery`): each required agreement carries a
 * server-computed `signed` flag that already encodes "signed the current
 * version" (annual re-consent / version bumps are handled server-side). The gate
 * selects the age-appropriate agreement (`consent` vs `assent`), ignores `tos`,
 * and shows the modal when the chosen agreement is unsigned.
 *
 * When the gate must show, it points the version-content query at the SAME
 * agreement + current version it checked (`consentAgreementId` /
 * `consentVersionId`); the content watcher opens the modal once the text loads.
 * Acceptance is recorded against that same version (see `updateConsent`).
 *
 * Compliance behavior:
 * - While the agreements query is unresolved (loading/errored), consent is
 *   UNRESOLVED: `isConsentResolved` stays false so the game list remains gated.
 *   We never fall through to "no consent needed" with an unknown requirement.
 * - The gate SHOWS whenever the student has not signed the current version and
 *   is old enough — regardless of the now-absent amount/expectedTime fields.
 */
function checkConsent() {
  // Close the gate while consent is being (re-)checked so the game list is never
  // visible mid-evaluation. Clear any pending content fetch so a stale
  // agreement's text can't open the modal. Re-opened only on a resolved branch.
  isConsentResolved.value = false;
  consentAgreementId.value = null;
  consentVersionId.value = null;

  // Until the agreements requirement resolves, leave the student gated.
  if (!isAgreementsResolved.value) {
    return;
  }

  const decision = resolveConsentRequirement({
    agreements: administrationAgreements.value,
    agreementsResolved: isAgreementsResolved.value,
    userData: userData.value,
  });

  // Requirement still unknown → keep the student gated rather than skipping.
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

  if (decision.shouldShow) {
    // Stay gated: point the content query at the agreement + current version the
    // gate checked, but do NOT mark consent resolved here. The content watcher
    // opens the modal AND marks consent resolved together once the text loads.
    // Resolving here would briefly expose the game list before the modal renders
    // (a fail-open window for an unsigned required consent).
    isConsentResolved.value = false;
    consentAgreementId.value = decision.agreementId;
    consentVersionId.value = decision.versionId;
    return;
  }

  // Required but already signed → resolved, no modal.
  isConsentResolved.value = true;
}

// Open the consent modal once the selected agreement's version content has
// loaded. Kept reactive (rather than awaited inline) so the modal text always
// reflects the agreement currently selected by `checkConsent()`. If the content
// query errors, the gate stays closed and the game list remains withheld
// (`isConsentResolved` is reset below) — failing safe rather than showing an
// empty modal or silently letting the student through.
watch([consentContent, isConsentContentError, consentAgreementId], ([content, hasError, agreementId]) => {
  if (!agreementId) return;

  if (hasError) {
    // Could not fetch the document text → block. Re-gate and keep the modal shut
    // rather than presenting the student with an un-signable consent form.
    isConsentResolved.value = false;
    showConsent.value = false;
    return;
  }

  if (content?.content) {
    confirmText.value = content.content;
    showConsent.value = true;
    // Now safe to mark resolved: the hard modal is up, so the game list stays
    // withheld (`canShowAssessments` requires `!showConsent`). This is the only
    // place the shouldShow path resolves — never before the modal renders.
    isConsentResolved.value = true;
  }
});

async function updateConsent() {
  // Record acceptance of the EXACT version the gate checked, then invalidate the
  // agreements query so the server re-computes `signed` (now true) and the next
  // `checkConsent()` run closes the modal. The gate only clears after a real
  // signature is recorded.
  if (!userId.value || !consentAgreementId.value || !consentVersionId.value) return;

  await recordUserAgreement({
    userId: userId.value,
    agreementVersionId: consentVersionId.value,
  });

  await queryClient.invalidateQueries({ queryKey: [USER_ADMINISTRATION_AGREEMENTS_QUERY_KEY] });
}

const toggleShowOptionalAssessments = () => {
  // Re-gate immediately on selection change. `checkConsent()` resets the gate to
  // "unresolved" against the (possibly stale) current agreements; the agreements
  // watcher below re-runs it once the newly-selected administration's agreements
  // resolve, so the student is never treated as consent-free across the switch.
  checkConsent();
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

// The participant's org memberships are needed only to build external launch URLs
// for generic external tasks (not internal players, qualtrics, or mefs). Fetch the
// memberships read on demand — gated on such a task being present in the selected
// administration — so the common internal-only homepage makes no extra backend call.
const needsOrgMembershipsForLaunch = computed(() => assessments.value.some(gameNeedsOrgMemberships));

const { data: memberships } = useUserMembershipsQuery(userId, {
  enabled: computed(() => initialized.value && Boolean(userId.value) && needsOrgMembershipsForLaunch.value),
});

// The data object passed to GameTabs: the backend user profile (`mapUser`) plus the
// three fields GameTabs reads that the user response doesn't carry — `birthMonth` /
// `birthYear` (derived from `studentData.dob`) and the current school / class IDs
// (from the memberships read; a student's school is the parent of their class). This
// reassembles the legacy `userData` shape from backend sources so `mapUser` and
// GameTabs stay unchanged.
const participantData = computed(() => {
  if (!userData.value) return null;

  // `dob` is an ISO calendar date (`YYYY-MM-DD`) from the backend; split it rather than
  // parsing via `new Date()` to avoid an off-by-one in negative-UTC timezones.
  const dob = userData.value.studentData?.dob ?? '';
  const [birthYear, birthMonth] = dob.split('-');

  const rows = memberships.value ?? [];
  const classRows = rows.filter((membership) => membership.entityType === 'class');
  const currentClassIds = [...new Set(classRows.map((membership) => membership.entityId))];
  const currentSchoolIds = [
    ...new Set([
      ...classRows.map((membership) => membership.schoolId).filter(Boolean),
      ...rows.filter((membership) => membership.entityType === 'school').map((membership) => membership.entityId),
    ]),
  ];

  return {
    ...userData.value,
    birthYear: birthYear ? Number(birthYear) : undefined,
    birthMonth: birthMonth ? Number(birthMonth) : undefined,
    schools: { current: currentSchoolIds },
    classes: { current: currentClassIds },
  };
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
// administration changes. Re-running here whenever the agreements (re)resolve
// guarantees the student is never treated as consent-free during the window
// between selecting an administration and its agreements loading.
watch(
  [userData, selectedAdminId, administrationAgreements, isAgreementsResolved],
  ([newUserData]) => {
    // Nothing to gate until we have a user and a selected administration. Abort
    // before touching the gate so a transition to "no administration" can't leave
    // it half-reset.
    if (_isEmpty(newUserData) || !selectedAdminId.value) return;

    // Re-derive the gate from scratch on every relevant change — an administration
    // switch OR an agreements refetch for the SAME administration. This is what
    // clears the modal after the student accepts: `updateConsent()` records the
    // signature and invalidates the agreements query, which refetches
    // `administrationAgreements` (now `signed: true`) and re-runs this watcher;
    // `checkConsent()` then sees it signed and leaves the modal shut. `checkConsent()`
    // resets `isConsentResolved` to false synchronously at its start and re-opens
    // the modal only if consent is still required, so no separate per-id pre-reset
    // is needed — and skipping the call on an unchanged id would break that
    // post-accept clearing.
    showConsent.value = false;
    checkConsent();
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
