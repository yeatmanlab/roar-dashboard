<template>
  <div>
    <div
      v-if="!initialized || isLoading || isFetching"
      class="loading-container bg-white-alpha-90"
      data-cy="home-participant__administration-loadingstate"
    >
      <AppSpinner style="margin-bottom: 1rem" />
      <span>{{ $t('homeParticipant.loadingAssignments') }}</span>
    </div>

    <div v-else-if="!hasAssignments" data-cy="home-participant__administration-emptystate">
      <div class="col-full text-center py-8">
        <h1>{{ $t('homeParticipant.noAssignments') }}</h1>
        <p class="text-center">{{ $t('homeParticipant.contactAdministrator') }}</p>

        <PvButton
          :label="$t('navBar.signOut')"
          class="no-underline bg-primary border-none border-round p-2 text-white hover:bg-red-900"
          icon="pi pi-sign-out"
          @click="signOut"
        />
      </div>
    </div>

    <div v-else data-cy="home-participant__administration">
      <div v-if="props.launchId" class="w-100 flex items-center justify-content-center bg-gray-100 p-2">
        <div class="font-bold text-lg text-gray-600" data-cy="participant-launch-mode">
          Currently in <span class="text-red-700 mr-4"> external launch mode </span>
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
      <div class="flex flex-row ml-5 align-items-end gap-2 justify-content-between">
        <PvFloatLabel class="mt-3 mr-3">
          <div v-if="userAssignments?.length > 0" class="flex flex-row align-items-start w-full mt-4">
            <div class="assignment-select-container">
              <div class="flex align-content-start w-full">
                <PvSelect
                  v-model="selectedAdmin"
                  :options="sortedUserAdministrations ?? []"
                  :option-label="getOptionLabel"
                  input-id="dd-assignment"
                  data-cy="dropdown-select-administration"
                  @change="toggleShowOptionalAssessments"
                />
                <label for="dd-assignment" class="mt-4">{{ $t('homeParticipant.selectAssignment') }}</label>
              </div>
            </div>
          </div>
        </PvFloatLabel>
        <div
          v-if="optionalAssessments.length !== 0"
          class="switch-container flex flex-row align-items-center justify-content-end mr-6 gap-2"
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
            v-if="showOptionalAssessments && userData"
            :games="optionalAssessments"
            :sequential="isSequential"
            :user-data="userData"
            :launch-id="launchId"
          />
          <GameTabs
            v-else-if="requiredAssessments && userData"
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
    v-if="showConsent && !isLevante"
    :consent-text="confirmText"
    :consent-type="consentType"
    :on-confirm="updateConsent"
  />
</template>

<script setup>
import { onMounted, ref, watch, watchEffect, computed } from 'vue';
import _filter from 'lodash/filter';
import _get from 'lodash/get';
import _find from 'lodash/find';
import _without from 'lodash/without';
import _isEmpty from 'lodash/isEmpty';
import { storeToRefs } from 'pinia';
import PvFloatLabel from 'primevue/floatlabel';
import PvButton from 'primevue/button';
import PvSelect from 'primevue/select';
import PvToggleSwitch from 'primevue/toggleswitch';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserAssignmentsQuery from '@/composables/queries/useUserAssignmentsQuery';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useSurveyReponsesQuery from '@/composables/queries/useSurveyResponsesQuery';
import useUpdateConsentMutation from '@/composables/mutations/useUpdateConsentMutation';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import useUserType from '@/composables/useUserType';
import { highestAdminOrgIntersection } from '@/helpers/query/assignments';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const consentType = ref('');
const consentParams = ref({});

const props = defineProps({
  launchId: { type: String, required: false, default: null },
});

const isLevante = import.meta.env.MODE === 'LEVANTE';

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
  if (roarfirekit.value.restConfig?.()) init();
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

const adminOrgIntersection = computed(() => {
  return highestAdminOrgIntersection(userData.value, authStore?.userClaims?.claims?.adminOrgs);
});
const orgType = ref(null);
const orgIds = ref(null);

watch(
  adminOrgIntersection,
  (newOrgIntersection) => {
    orgType.value = newOrgIntersection?.orgType;
    orgIds.value = newOrgIntersection?.orgIds;
  },
  { immediate: true },
);

const isOrgIntersectionReady = ref(false);

const userAssignmentsQueryEnabled = computed(() => {
  return isOrgIntersectionReady.value && initialized.value;
});

const { data: userClaims } = useUserClaimsQuery({
  enabled: initialized,
});

const { isSuperAdmin } = useUserType(userClaims);

watchEffect(() => {
  // If user is superadmin, or is a non-externally launched participant we won't need to compute the orgIntersection
  if (isSuperAdmin.value || !props.launchId) {
    isOrgIntersectionReady.value = true;
  } else {
    isOrgIntersectionReady.value = !!orgType.value && !!orgIds.value;
  }
});

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: userAssignments,
} = useUserAssignmentsQuery(
  {
    enabled: userAssignmentsQueryEnabled,
  },
  props.launchId,
  !isSuperAdmin.value ? orgType : null,
  !isSuperAdmin.value ? orgIds : null,
);

const sortedUserAdministrations = computed(() => {
  return [...(userAssignments.value ?? [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
});

const taskIds = computed(() => (selectedAdmin.value?.assessments ?? []).map((assessment) => assessment.taskId));
const tasksQueryEnabled = computed(() => !isLoadingAssignments.value && !_isEmpty(taskIds.value));

const {
  isLoading: isLoadingTasks,
  isFetching: isFetchingTasks,
  data: userTasks,
} = useTasksQuery(false, taskIds, {
  enabled: tasksQueryEnabled,
});

const { data: surveyResponsesData } = useSurveyReponsesQuery({
  enabled: initialized.value && isLevante,
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

async function checkConsent() {
  const dob = new Date(userData.value?.studentData?.dob);
  const grade = userData.value?.studentData?.grade;
  const currentDate = new Date();
  const age = currentDate.getFullYear() - dob.getFullYear();
  const legal = selectedAdmin.value?.legal;

  if (!legal?.consent) {
    // Always show consent form for this test student when running Cypress tests
    // @TODO: Remove this once we update the E2E tests to handle the consent form without persisting state. This would
    // improve the test relability as enforcing the below condition defeats parts of the test purpose.
    if (userData.value?.id === 'O75V6IcVeiTwW8TRjXb76uydlwV2') {
      consentType.value = 'consent';
      confirmText.value = 'This is a test student. Please do not accept this form.';
      showConsent.value = true;
    }
    return;
  }

  const isAdult = age >= 18;
  const isSeniorGrade = grade >= 12;
  const isOlder = isAdult || isSeniorGrade;

  let docTypeKey = isOlder ? 'consent' : 'assent';
  let docType = legal[docTypeKey][0]?.type.toLowerCase();
  let docAmount = legal?.amount;
  let docExpectedTime = legal?.expectedTime;

  consentType.value = docType;

  const consentStatus = userData.value?.legal?.[consentType.value];
  const consentDoc = await authStore.getLegalDoc(docType);
  consentVersion.value = consentDoc.version;

  // Determine the start of the school year (August 1st).
  // If the current date is before August 1st, use the previous year's date.
  // @NOTE: We consider the school year to start on August 1st
  const latestAugust =
    currentDate.getMonth() < 7
      ? new Date(currentDate.getFullYear() - 1, 7, 1)
      : new Date(currentDate.getFullYear(), 7, 1);

  if (consentStatus?.[consentDoc.version]) {
    const legalDocs = consentStatus?.[consentDoc.version];

    let found = false;
    let signedBeforeAugFirst = false;

    for (const document of legalDocs) {
      const signedDate = new Date(document.dateSigned);

      if (document.amount === docAmount && document.expectedTime === docExpectedTime) {
        found = true;

        /**
         * Checks if a given date is before the start of the current school year.
         *
         * @param {string} signedDate - The date to check, in the format 'YYYY-MM-DD'.
         * @set {boolean} signedBeforeAugFirst to True if the given date is before the start of the current school year.
         */
        if (signedDate < latestAugust) {
          signedBeforeAugFirst = true;
          break;
        }
      }

      // If the signedDate is invalid (e.g., an invalid date string), mark the document as needing resigning.
      // This is because it's not possible to determine whether it was signed before the school year start date.
      if (isNaN(new Date(document.dateSigned)) && currentDate >= latestAugust) {
        signedBeforeAugFirst = true;
        break;
      }
    }

    // Show the consent form if no document is found or if a document was signed before August 1st.
    if (!found || signedBeforeAugFirst) {
      if (docAmount !== '' || docExpectedTime !== '' || signedBeforeAugFirst) {
        confirmText.value = consentDoc.text;
        showConsent.value = true;
        return;
      }
    }
  } else if (age > 7 || grade > 1) {
    confirmText.value = consentDoc.text;
    showConsent.value = true;
    return;
  }
}

async function updateConsent() {
  consentParams.value = {
    amount: selectedAdmin.value?.legal.amount,
    expectedTime: selectedAdmin.value?.legal.expectedTime,
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

// Assessments to populate the game tabs.
// Generated based on the current selected administration Id
const assessments = computed(() => {
  if (!isFetching.value && selectedAdmin.value && (userTasks.value ?? []).length > 0) {
    const fetchedAssessments = _without(
      selectedAdmin.value.assessments.map((assessment) => {
        // Get the matching assessment from userAssignments
        const matchingAssignment = _find(userAssignments.value, { id: selectedAdmin.value.id });
        const matchingAssessments = matchingAssignment?.assessments ?? [];
        const matchingAssessment = _find(matchingAssessments, { taskId: assessment.taskId });

        // If no matching assessments were found, then this assessment is not assigned to the user.
        // It is in the administration but the user does not meet the conditional requirements for assignment.
        // Return undefined, which will be filtered out using lodash _without above.
        if (!matchingAssessment) return undefined;
        const optionalAssessment = _find(matchingAssessments, { taskId: assessment.taskId, optional: true });
        const combinedAssessment = {
          ...matchingAssessment,
          ...optionalAssessment,
          ...assessment,
          taskData: {
            ..._find(userTasks.value ?? [], { id: assessment.taskId }),
            variantURL: assessment?.params?.variantURL,
          },
        };
        return combinedAssessment;
      }),
      undefined,
    );

    if (authStore.userData?.userType === 'student' && isLevante) {
      // This is just to mark the card as complete
      if (gameStore.isSurveyCompleted || surveyResponsesData.value?.length) {
        fetchedAssessments.forEach((assessment) => {
          if (assessment.taskId === 'Survey') {
            assessment.completedOn = new Date();
          }
        });
      }
    }

    return fetchedAssessments;
  }
  return [];
});

const requiredAssessments = computed(() => {
  return _filter(assessments.value, (assessment) => !assessment.optional);
});

const optionalAssessments = computed(() => {
  return _filter(assessments.value, (assessment) => assessment.optional);
});

// Grab the sequential key from the current administration's data object
const isSequential = computed(() => {
  return (
    _get(
      _find(userAssignments.value, (administration) => {
        return administration.id === selectedAdmin.value.id;
      }),
      'sequential',
    ) ?? true
  );
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
  if (isLevante) return null;

  return {
    grade: userData.value?.studentData?.grade,
  };
});

watch(
  [userData, selectedAdmin, userAssignments],
  async ([newUserData, isSelectedAdminChanged]) => {
    // If the assignments are still loading, abort.
    if (isLoadingAssignments.value || isFetchingAssignments.value || !userAssignments.value?.length) return;

    // If the selected admin changed, ensure consent was given before proceeding.
    if (!_isEmpty(newUserData) && isSelectedAdminChanged) {
      await checkConsent();
    }

    const selectedAdminId = selectedAdmin.value?.id;
    const allAdminIds = userAssignments.value?.map((administration) => administration.id) ?? [];

    // Verify that we have a selected administration and it is in the list of all assigned administrations.
    if (selectedAdminId && allAdminIds.includes(selectedAdminId)) {
      // Ensure that the selected administration is a fresh instance of the administration. Whilst this seems redundant,
      // this is apparently relevant in the case that the game store does not flush properly.
      selectedAdmin.value = sortedUserAdministrations.value.find(
        (administration) => administration.id === selectedAdminId,
      );

      return;
    }

    // Otherwise, choose the first sorted administration if there is no selected administration.
    selectedAdmin.value = sortedUserAdministrations.value[0];
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

.loading-container {
  width: 100%;
  text-align: center;
}
</style>
