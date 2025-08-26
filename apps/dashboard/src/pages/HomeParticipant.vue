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
      <div class="py-8 text-center col-full">
        <h1>{{ $t('homeParticipant.noAssignments') }}</h1>
        <p class="text-center">{{ $t('homeParticipant.contactAdministrator') }}</p>

        <PvButton
          :label="$t('navBar.signOut')"
          class="p-2 text-white no-underline border-none bg-primary border-round hover:bg-red-900"
          icon="pi pi-sign-out"
          @click="signOut"
        />
      </div>
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
    v-if="showConsent"
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
import useUpdateConsentMutation from '@/composables/mutations/useUpdateConsentMutation';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import useUserType from '@/composables/useUserType';
import { highestAdminOrgIntersection } from '@/helpers/query/assignments';
import { checkConsentRenewalDate } from '@/helpers/checkConsentRenewalDate';
import useUserClaimsQuery from '@/composables/queries/useUserClaimsQuery';

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

  if (consentStatus?.[consentDoc.version]) {
    const hasUpdatedConsent = checkConsentRenewalDate(consentStatus?.[consentDoc.version]);
    // Show the consent form if the latest document was signed before August 1st.
    if (!hasUpdatedConsent) {
      if (docAmount !== '' || docExpectedTime !== '') {
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
