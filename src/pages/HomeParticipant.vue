<template>
  <div>
    <div v-if="isFetching" class="loading-container py-8">
      <AppSpinner style="margin-bottom: 1rem" />
      <span>{{ $t('homeParticipant.loadingAssignments') }}</span>
    </div>

    <div v-else>
      <div v-if="!hasAssignments">
        <div class="col-full text-center py-8">
          <h1>{{ $t('homeParticipant.noAssignments') }}</h1>
          <p class="text-center">{{ $t('homeParticipant.contactAdministrator') }}</p>
          <router-link :to="{ name: 'SignOut' }">
            <PvButton
              :label="$t('navBar.signOut')"
              class="no-underline bg-primary border-none border-round p-2 text-white hover:bg-red-900"
              icon="pi pi-sign-out"
            />
          </router-link>
        </div>
      </div>

      <div v-else>
        <h2 v-if="userAdministrations?.length == 1" class="p-float-label dropdown-container">
          {{ userAdministrations.at(0).publicName || userAdministrations.at(0).name }}
        </h2>
        <div class="flex flex-row-reverse align-items-end gap-2 justify-content-between">
          <div
            v-if="optionalAssessments.length !== 0"
            class="switch-container flex flex-row align-items-center justify-content-end mr-6 gap-2"
          >
            <PvInputSwitch
              v-model="showOptionalAssessments"
              input-id="switch-optional"
              data-cy="switch-show-optional-assessments"
            />
            <label for="switch-optional" class="mr-2 text-gray-500">{{
              $t('homeParticipant.showOptionalAssignments')
            }}</label>
          </div>
          <div
            v-if="userAdministrations?.length > 0"
            class="flex flex-row justify-center align-items-center p-float-label dropdown-container gap-4 w-full"
          >
            <div class="assignment-select-container flex flex-row justify-content-between justify-content-start">
              <div class="flex flex-column align-content-start justify-content-start w-3">
                <PvDropdown
                  v-if="userAdministrations.every((administration) => administration.publicName)"
                  v-model="selectedAdmin"
                  :options="sortedUserAdministrations ?? []"
                  option-label="publicName"
                  input-id="dd-assignment"
                  data-cy="dropdown-select-administration"
                  @change="toggleShowOptionalAssessments"
                />
                <PvDropdown
                  v-else
                  v-model="selectedAdmin"
                  :options="sortedUserAdministrations ?? []"
                  option-label="name"
                  input-id="dd-assignment"
                  data-cy="dropdown-select-administration"
                  @change="toggleShowOptionalAssessments"
                />
                <label for="dd-assignment">{{ $t('homeParticipant.selectAssignment') }}</label>
              </div>
            </div>
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
            />
            <GameTabs
              v-else-if="requiredAssessments && userData"
              :games="requiredAssessments"
              :sequential="isSequential"
              :user-data="userData"
            />
          </Transition>
        </div>
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
import { onMounted, ref, watch, computed, toRaw } from 'vue';
import _filter from 'lodash/filter';
import _get from 'lodash/get';
import _find from 'lodash/find';
import _without from 'lodash/without';
import _isEmpty from 'lodash/isEmpty';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { storeToRefs } from 'pinia';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserAssignmentsQuery from '@/composables/queries/useUserAssignmentsQuery';
import useAdministrationsQuery from '@/composables/queries/useAdministrationsQuery';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useSurveyReponsesQuery from '@/composables/queries/useSurveyResponsesQuery';
import useUpdateConsentMutation from '@/composables/mutations/useUpdateConsentMutation';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';

const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const consentType = ref('');
const consentParams = ref({});

const isLevante = import.meta.env.MODE === 'LEVANTE';

const { mutateAsync: updateConsentStatus } = useUpdateConsentMutation();

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { roarfirekit, showOptionalAssessments } = storeToRefs(authStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
});

const gameStore = useGameStore();
const { selectedAdmin } = storeToRefs(gameStore);

const {
  isLoading: isLoadingUserData,
  isFetching: isFetchingUserData,
  data: userData,
} = useUserDataQuery(null, {
  enabled: initialized,
});

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: userAssignments,
} = useUserAssignmentsQuery({
  enabled: initialized,
});

const administrationIds = computed(() => (userAssignments.value ?? []).map((assignment) => assignment.id));
const administrationQueryEnabled = computed(() => !isLoadingAssignments.value && !_isEmpty(administrationIds.value));

const {
  isLoading: isLoadingAdmins,
  isFetching: isFetchingAdmins,
  data: userAdministrations,
} = useAdministrationsQuery(administrationIds, {
  enabled: administrationQueryEnabled,
});

const sortedUserAdministrations = computed(() => {
  return [...(userAdministrations.value ?? [])].sort((a, b) => a.name.localeCompare(b.name));
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
  return isLoadingUserData.value || isLoadingAssignments.value || isLoadingAdmins.value || isLoadingTasks.value;
});

const isFetching = computed(() => {
  return isFetchingUserData.value || isFetchingAssignments.value || isFetchingAdmins.value || isFetchingTasks.value;
});

const hasAssignments = computed(() => {
  if (isFetching.value || isLoading.value) return false;
  return assessments.value.length !== 0;
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

  if (consentStatus?.[consentDoc.version]) {
    const legalDocs = consentStatus?.[consentDoc.version];

    let found = false;
    let signedBeforeAugFirst = false;

    const augustFirstThisYear = new Date(currentDate.getFullYear(), 7, 1); // August 1st of the current year

    for (const document of legalDocs) {
      const signedDate = new Date(document.dateSigned);

      if (document.amount === docAmount && document.expectedTime === docExpectedTime) {
        found = true;

        if (signedDate < augustFirstThisYear && currentDate >= augustFirstThisYear) {
          signedBeforeAugFirst = true;
          break;
        }
      }

      if (isNaN(new Date(document.dateSigned)) && currentDate >= augustFirstThisYear) {
        signedBeforeAugFirst = true;
        break;
      }
    }

    // If any document is signed after August 1st, do not show the consent form
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
      _find(userAdministrations.value, (administration) => {
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
  [userData, selectedAdmin, userAdministrations],
  async ([updatedUserData, updatedSelectedAdmin]) => {
    if (!_isEmpty(updatedUserData) && updatedSelectedAdmin) {
      await checkConsent();
    }

    const selectedAdminId = selectedAdmin.value?.id;
    const allAdminIds = (userAdministrations.value ?? []).map((administration) => administration.id);
    // If there is no selected administration or if the selected administration is not in the list
    // of all administrations choose the first one after sorting alphabetically by publicName
    if (allAdminIds.length > 0 && (!selectedAdminId || !allAdminIds.includes(selectedAdminId))) {
      // Choose the first sorted administration
      selectedAdmin.value = sortedUserAdministrations.value[0];
    }
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
