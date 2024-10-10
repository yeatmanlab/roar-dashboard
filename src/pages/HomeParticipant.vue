<template>
  <div>
    <div v-if="!noGamesAvailable || consentSpinner">
      <div v-if="isFetching" class="loading-container">
        <AppSpinner style="margin-bottom: 1rem" />
        <span>{{ $t('homeParticipant.loadingAssignments') }}</span>
      </div>
      <div v-else>
        <h2 v-if="adminInfo?.length == 1" class="p-float-label dropdown-container">
          {{ adminInfo.at(0).publicName || adminInfo.at(0).name }}
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
            v-if="adminInfo?.length > 0"
            class="flex flex-row justify-center align-items-center p-float-label dropdown-container gap-4 w-full"
          >
            <div class="assignment-select-container flex flex-row justify-content-between justify-content-start">
              <div class="flex flex-column align-content-start justify-content-start w-3">
                <PvDropdown
                  v-if="adminInfo.every((admin) => admin.publicName)"
                  v-model="selectedAdmin"
                  :options="sortedAdminInfo ?? []"
                  option-label="publicName"
                  input-id="dd-assignment"
                  data-cy="dropdown-select-administration"
                  @change="toggleShowOptionalAssessments"
                />
                <PvDropdown
                  v-else
                  v-model="selectedAdmin"
                  :options="sortedAdminInfo ?? []"
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
              v-if="showOptionalAssessments"
              :games="optionalAssessments"
              :sequential="isSequential"
              :user-data="userData"
            />
            <GameTabs v-else :games="requiredAssessments" :sequential="isSequential" :user-data="userData" />
          </Transition>
        </div>
      </div>
    </div>
    <div v-else>
      <div class="col-full text-center">
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
  </div>
  <!-- && !isLevante -->
  <ConsentModal
    v-if="showConsent"
    :consent-text="confirmText"
    :consent-type="consentType"
    @accepted="updateConsent"
  />
</template>

<script setup>
import { onMounted, ref, watch, computed, toRaw } from 'vue';
import _filter from 'lodash/filter';
import _get from 'lodash/get';
import _find from 'lodash/find';
import _without from 'lodash/without';
import _forEach from 'lodash/forEach';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { fetchDocById, fetchDocsById, } from '../helpers/query/utils';
import { getUserAssignments } from '../helpers/query/assignments';
import ConsentModal from '../components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import { isLevante } from '@/helpers';
import useSurveyResponses from '@/composables/useSurveyResponses/useSurveyResponses';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';
import { Model, settings } from 'survey-core';
import { Converter } from 'showdown';
import { fetchAudioLinks, } from '@/helpers/survey';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useQueryClient } from '@tanstack/vue-query';
import { initializeSurvey, setupSurveyEventHandlers } from '@/helpers/surveyInitialization';
import { usersPageFetcher } from '@/helpers/query/users';

const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const consentType = ref('');
const consentParams = ref({});
const { locale } = useI18n();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { roarfirekit, uid, consentSpinner, userQueryKeyIndex, assignmentQueryKeyIndex } = storeToRefs(authStore);

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
} = useQuery({
  queryKey: ['userData', uid, userQueryKeyIndex],
  queryFn: () => fetchDocById('users', uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

const {
  isLoading: isLoadingAssignments,
  isFetching: isFetchingAssignments,
  data: assignmentInfo,
} = useQuery({
  queryKey: ['assignments', uid, assignmentQueryKeyIndex],
  queryFn: () => getUserAssignments(uid.value),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 min
  // For MEFS, since it is opened in a separate tab
  refetchOnWindowFocus: 'always',
});

const administrationIds = computed(() => (assignmentInfo.value ?? []).map((assignment) => assignment.id));
const administrationQueryEnabled = computed(() => !isLoadingAssignments.value);

const {
  isLoading: isLoadingAdmins,
  isFetching: isFetchingAdmins,
  data: adminInfo,
} = useQuery({
  queryKey: ['administrations', uid, administrationIds],
  queryFn: () =>
    fetchDocsById(
      administrationIds.value.map((administrationId) => {
        return {
          collection: 'administrations',
          docId: administrationId,
          select: ['name', 'publicName', 'sequential', 'assessments', 'legal'],
        };
      }),
    ),
  keepPreviousData: true,
  enabled: administrationQueryEnabled,
  staleTime: 5 * 60 * 1000,
});

const sortedAdminInfo = computed(() => {
  return [...(adminInfo.value ?? [])].sort((a, b) => a.name.localeCompare(b.name));
});

async function checkConsent() {
  showConsent.value = false;

  const legal = selectedAdmin.value?.legal;
  if (!legal) return;

  if (!isLevante) {
    const dob = new Date(userData.value?.studentData.dob);
    const grade = userData.value?.studentData.grade;
    const currentDate = new Date();
    const age = currentDate.getFullYear() - dob.getFullYear();

    if (!legal?.consent) {
      // Always show consent form for this test student when running Cypress tests
      if (userData.value?.id === 'XAq5qOuXnNPHClK0xZXXhfGsWX22') {
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

    const consentStatus = _get(userData.value, `legal.${consentType.value}`);
    const consentDoc = await authStore.getLegalDoc(docType);
    consentVersion.value = consentDoc.version;

    if (_get(toRaw(consentStatus), consentDoc.version)) {
      const legalDocs = _get(toRaw(consentStatus), consentDoc.version);
      let found = false;
      _forEach(legalDocs, (document) => {
        if (document.amount === docAmount && document.expectedTime === docExpectedTime) {
          found = true;
        }
      });

      if (!found) {
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
    // LEVANTE
  } else {
    // Check if the user has already consented to the Levante consent form
    const consentStatus = _get(userData.value, `legal.consent`);
    if (consentStatus) {
      return;
    }

    try {
      const consentDoc = await authStore.getLegalDoc(`${locale.value}Consent`); 
      
      if (!consentDoc) return

      consentType.value = toRaw(legal).consent[0].type;
      confirmText.value = consentDoc.text;
      consentVersion.value = consentDoc.version;
      showConsent.value = true;
    } catch {
      console.log('Error getting consent doc');
    }
  }
}

async function updateConsent() {
  consentParams.value = {
    amount: selectedAdmin.value?.legal.amount,
    expectedTime: selectedAdmin.value?.legal.expectedTime,
    dateSigned: new Date(),
  };
  try {
    // args: docName, consentVersion, params
    await authStore.updateConsentStatus(consentType.value, consentVersion.value, consentParams.value);
    userQueryKeyIndex.value += 1;
  } catch {
    console.log("Couldn't update consent value");
  }
}

const taskIds = computed(() => (selectedAdmin.value?.assessments ?? []).map((assessment) => assessment.taskId));

const {
  isLoading: isLoadingTasks,
  isFetching: isFetchingTasks,
  data: taskInfo,
} = useQuery({
  queryKey: ['tasks', uid, taskIds],
  queryFn: () => {
    return fetchDocsById(
      taskIds.value.map((taskId) => ({
        collection: 'tasks',
        docId: taskId,
      })),
      'app',
    );
  },
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000,
});


const { data: surveyResponsesData } = useSurveyResponses(undefined, isLevante);


const audioLinkMap = ref({});

const { isLoading: isLoadingSurvey, data: surveyData } = useQuery({
  queryKey: ['surveys'],
  queryFn: async () => {
    const userType = userData.value.userType;

    if (userType === 'student') {
      const res = await axios.get(`${LEVANTE_BUCKET_URL}/child_survey.json`);
      audioLinkMap.value = await fetchAudioLinks('child-survey');
      return {
        general: res.data,
      };
    } else if (userType === 'teacher') {
      const resGeneral = await axios.get(`${LEVANTE_BUCKET_URL}/teacher_survey_general.json`);
      const resClassroom = await axios.get(`${LEVANTE_BUCKET_URL}/teacher_survey_classroom.json`);
      return {
        general: resGeneral.data,
        specific: resClassroom.data,
      };
    } else {
      // parent
      const resFamily = await axios.get(`${LEVANTE_BUCKET_URL}/parent_survey_family.json`);
      const resChild = await axios.get(`${LEVANTE_BUCKET_URL}/parent_survey_child.json`);
      return {
        general: resFamily.data,
        specific: resChild.data,
      };
    }
  },
  enabled: isLevante && userData?.value?.userType !== 'admin' && initialized,
  staleTime: 24 * 60 * 60 * 1000, // 24 hours
});


const surveyDependenciesLoaded = computed(() => {
  return surveyData.value && userData.value && selectedAdmin.value && surveyResponsesData.value
});

const userType = computed(() => userData.value?.userType);

const specificSurveyData = computed(() => {
  if (!surveyData.value) return null;
  return userType.value === 'student' ? null : surveyData.value.specific;
});

function createSurveyInstance(surveyDataToStartAt) {
  settings.lazyRender = true;
  const surveyInstance = new Model(surveyDataToStartAt);
  // surveyInstance.showNavigationButtons = 'none';
  surveyInstance.locale = locale.value;
  return surveyInstance;
}

function setupMarkdownConverter(surveyInstance) {
  const converter = new Converter();
  surveyInstance.onTextMarkdown.add((survey, options) => {
    let str = converter.makeHtml(options.text);
    str = str.substring(3, str.length - 4);
    options.html = str;
  });
}


watch(surveyDependenciesLoaded, async (isLoaded) => {
  const isAssessment = selectedAdmin.value?.assessments.some((task) => task.taskId === 'survey');
  if (!isLoaded || !isAssessment || gameStore.survey) return;

  const surveyResponseDoc = surveyResponsesData.value.find((doc) => doc?.administrationId === selectedAdmin.value.id);
  
  if (surveyResponseDoc) {
    if (userType.value === 'student') {
      const isComplete = surveyResponseDoc.general.isComplete;
      gameStore.setIsGeneralSurveyComplete(isComplete);
      if (isComplete) return;
    } else {
      gameStore.setIsGeneralSurveyComplete(surveyResponseDoc.general.isComplete);

      const numOfSpecificSurveys = userType.value === 'parent' ? userData.value.childIds.length : userData.value.classes.current.length;
      
      if (surveyResponseDoc.specific && surveyResponseDoc.specific.length > 0) {
        if (surveyResponseDoc.specific.length === numOfSpecificSurveys && surveyResponseDoc.specific.every(relation => relation.isComplete)) {
          gameStore.setIsSpecificSurveyComplete(true);
        } else {
          const incompleteIndex = surveyResponseDoc.specific.findIndex(relation => !relation.isComplete);
          console.log('incompleteIndex in home participant', incompleteIndex);
          if (incompleteIndex > -1) {
            gameStore.setSpecificSurveyRelationIndex(incompleteIndex);
          } else {
            gameStore.setSpecificSurveyRelationIndex(surveyResponseDoc.specific.length);
          }
        }
      }
    }
  }

  if (userType.value === 'student' && gameStore.isGeneralSurveyComplete) {
    return
  } else if (userType.value === 'teacher' || userType.value === 'parent') {
    if (gameStore.isGeneralSurveyComplete && gameStore.isSpecificSurveyComplete) {
      return
    }
  }

  console.log('specificSurveyRelationIndex after logic', gameStore.specificSurveyRelationIndex);

  const surveyDataToStartAt = userType.value === 'student' || !gameStore.isGeneralSurveyComplete
    ? surveyData.value.general
    : surveyData.value.specific;

  // Fetch child docs for parent or class docs for teacher
  if ((userType.value === 'parent' || userType.value === 'teacher') && gameStore.isGeneralSurveyComplete) {
    try {
      const fetchConfig = userType.value === 'parent'
        ? userData.value.childIds.map(childId => ({
            collection: 'users',
            docId: childId,
            select: ['birthMonth', 'birthYear'],
          }))
        : userData.value.classes.current.map(classId => ({
            collection: 'classes',
            docId: classId,
            select: ['name'],
          }));
      
      const res = await fetchDocsById(fetchConfig);
      console.log('res', res)
      gameStore.setSpecificSurveyRelationData(res);
    } catch (error) {
      console.error('Error fetching relation data:', error);
    }
  }

  const surveyInstance = createSurveyInstance(surveyDataToStartAt);
  setupMarkdownConverter(surveyInstance);

  await initializeSurvey({
    surveyInstance,
    userType: userType.value,
    specificSurveyData: specificSurveyData.value,
    userData: userData.value,
    gameStore,
    locale: locale.value,
    audioLinkMap: audioLinkMap.value,
    generalSurveyData: surveyData.value.general,
  });

  setupSurveyEventHandlers({
    surveyInstance,
    userType: userType.value,
    roarfirekit: roarfirekit.value,
    uid: uid.value,
    selectedAdminId: selectedAdmin.value.id,
    gameStore,
    router,
    toast,
    queryClient,
    userData: userData.value,
  });

  gameStore.setSurvey(surveyInstance);

}, { immediate: true });

const isLoading = computed(() => {
  const commonLoading = isLoadingUserData.value || isLoadingAssignments.value || isLoadingAdmins.value || isLoadingTasks.value;

  if (isLevante) {
    return commonLoading || isLoadingSurvey.value;
  } else {
    return commonLoading;
  }
});

const isFetching = computed(() => {
  return isFetchingUserData.value || isFetchingAssignments.value || isFetchingAdmins.value || isFetchingTasks.value;
});

const noGamesAvailable = computed(() => {
  if (isFetching.value || isLoading.value) return false;
  return assessments.value.length === 0;
});

const showOptionalAssessments = ref(null);
const toggleShowOptionalAssessments = async () => {
  await checkConsent();
  showOptionalAssessments.value = null;
};

// Assessments to populate the game tabs.
// Generated based on the current selected admin Id
const assessments = computed(() => {
  if (!isFetching.value && selectedAdmin.value && (taskInfo.value ?? []).length > 0) {
    const fetchedAssessments = _without(
      selectedAdmin.value.assessments.map((assessment) => {
        // Get the matching assessment from assignmentInfo
        const matchingAssignment = _find(assignmentInfo.value, { id: selectedAdmin.value.id });
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
            ..._find(taskInfo.value ?? [], { id: assessment.taskId }),
            variantURL: _get(assessment, 'params.variantURL'),
          },
        };
        return combinedAssessment;
      }),
      undefined,
    );

    if (isLevante) {
      // Mark the survey as complete as if it was a task
      if (userType.value === 'student') {
        if (gameStore.isGeneralSurveyComplete) {
          fetchedAssessments.forEach((assessment) => {
            if (assessment.taskId === 'survey') {
              assessment.completedOn = new Date();
            }
          });
        }
      } else if (userType.value === 'teacher' || userType.value === 'parent') {
        if (gameStore.isGeneralSurveyComplete && gameStore.isSpecificSurveyComplete) {
          fetchedAssessments.forEach((assessment) => {
            if (assessment.taskId === 'survey') {
              assessment.completedOn = new Date();
            }
          });
        }
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

// Grab the sequential key from the current admin's data object
const isSequential = computed(() => {
  return (
    _get(
      _find(adminInfo.value, (admin) => {
        return admin.id === selectedAdmin.value.id;
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
  if (isLevante) {
    return {};
  }
  return {
    grade: _get(userData.value, 'studentData.grade'),
  };
});

watch(
  [selectedAdmin, adminInfo],
  ([updateSelectedAdmin]) => {
    if (updateSelectedAdmin) {
      checkConsent();
    }
    const selectedAdminId = selectedAdmin.value?.id;
    const allAdminIds = (adminInfo.value ?? []).map((admin) => admin.id);
    // If there is no selected admin or if the selected admin is not in the list
    // of all administrations choose the first one after sorting alphabetically by publicName
    if (allAdminIds.length > 0 && (!selectedAdminId || !allAdminIds.includes(selectedAdminId))) {
      // Choose the first sorted administration
      selectedAdmin.value = sortedAdminInfo.value[0];
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
