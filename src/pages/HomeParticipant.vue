<template>
  <div>
    <div v-if="!initialized || isLoading || isFetching">
      <LevanteSpinner fullscreen />
    </div>

    <div v-else-if="!hasAssignments">
      <div class="col-full text-center py-8">
        <h1>{{ $t('homeParticipant.noAssignments') }}</h1>
        <p class="text-center">
          {{ $t('homeParticipant.contactAdministrator') }}
        </p>
        <PvButton
          :label="$t('navBar.signOut')"
          class="no-underline bg-primary border-none border-round p-2 text-white hover:bg-red-900"
          icon="pi pi-sign-out"
          @click="signOut"
        />
      </div>
    </div>

    <div v-else>
      <div class="assignment">
        <div class="assignment__header">
          <PvTag
            :value="t(`participant-sidebar.${getAssignmentStatus(selectedAssignment)}`)"
            class="text-xs uppercase"
            :class="`assignment__status --${getAssignmentStatus(selectedAssignment)}`"
          />

          <h2 class="assignment__name">
            {{ selectedAssignment?.publicName || selectedAssignment?.name }}
          </h2>

          <div v-if="selectedAssignment?.dateOpened && selectedAssignment?.dateClosed" class="assignment__dates">
            <div class="assignment__date">
              <i class="pi pi-calendar"></i>
              <small
                ><span class="font-bold">{{ assignmentStartDateLabel }}</span>
                {{ format(selectedAssignment?.dateOpened, 'MMM dd, yyyy') }}</small
              >
            </div>
            <div class="assignment__date">
              <i class="pi pi-calendar"></i>
              <small
                ><span class="font-bold">{{ assignmentEndDateLabel }}</span>
                {{ format(selectedAssignment?.dateClosed, 'MMM dd, yyyy') }}</small
              >
            </div>
          </div>
        </div>

        <div class="assignment__main">
          <ParticipantSidebar :total-games="totalGames" :completed-games="completeGames" />

          <div class="tabs-container">
            <Transition name="fade" mode="out-in">
              <!-- TODO: Pass in data conditionally to one instance of GameTabs. -->
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
  </div>
  <ConsentModal
    v-if="showConsent"
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
import { storeToRefs } from 'pinia';
import PvButton from 'primevue/button';
import { useAuthStore } from '@/store/auth';
import { useAssignmentsStore } from '@/store/assignments';
import useUserDataQuery from '@/composables/queries/useUserDataQuery';
import useUserAssignmentsQuery from '@/composables/queries/useUserAssignmentsQuery';
import useTasksQuery from '@/composables/queries/useTasksQuery';
import useSurveyResponsesQuery from '@/composables/useSurveyResponses/useSurveyResponses';
import useUpdateConsentMutation from '@/composables/mutations/useUpdateConsentMutation';
import useSignOutMutation from '@/composables/mutations/useSignOutMutation';
import useDistrictsQuery from '@/composables/queries/useDistrictsQuery';
import ConsentModal from '@/components/ConsentModal.vue';
import GameTabs from '@/components/GameTabs.vue';
import ParticipantSidebar from '@/components/ParticipantSidebar.vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import { LEVANTE_BUCKET_URL } from '@/constants/bucket';
import { Model, settings } from 'survey-core';
import { Converter } from 'showdown';
import { fetchAudioLinks, getParsedLocale } from '@/helpers/survey';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useQueryClient, useQuery } from '@tanstack/vue-query';
import { initializeSurvey, setupSurveyEventHandlers } from '@/helpers/surveyInitialization';
import { useSurveyStore } from '@/store/survey';
import { fetchDocsById } from '@/helpers/query/utils';
import LevanteSpinner from '@/components/LevanteSpinner.vue';
import { logger } from '@/logger';
import { format } from 'date-fns';
import PvTag from 'primevue/tag';
import { getAssignmentStatus, isCurrent, sortAssignmentsByDateOpened } from '@/helpers/assignments';

const showConsent = ref(false);
const consentVersion = ref('');
const confirmText = ref('');
const consentType = ref('');
const consentParams = ref({});
const { locale, t } = useI18n();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const surveyStore = useSurveyStore();

const { mutateAsync: updateConsentStatus } = useUpdateConsentMutation();
const { mutate: signOut } = useSignOutMutation();

let unsubscribe;
const initialized = ref(false);
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};

const authStore = useAuthStore();
const { roarfirekit, showOptionalAssessments, userData: currentUserData } = storeToRefs(authStore);

const assignmentsStore = useAssignmentsStore();
const { selectedAssignment, selectedStatus, userAssignments } = storeToRefs(assignmentsStore);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
});

const {
  data: districtsData,
  isLoading: isLoadingDistricts,
  isFetching: isFetchingDistricts,
} = useDistrictsQuery(currentUserData.value?.districts?.current, {
  enabled: initialized,
});

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
  data: userAssignmentsData,
} = useUserAssignmentsQuery({
  enabled: initialized,
});

const sortedUserAdministrations = computed(() => sortAssignmentsByDateOpened(userAssignments.value));

const sortedUserCurrentAdministrations = computed(() =>
  sortAssignmentsByDateOpened(
    userAssignments.value.filter((assignment) => isCurrent(assignment) && assignment?.completed === false),
  ),
);

const now = computed(() => new Date());

const assignmentStartDateLabel = computed(() => {
  const dateOpened = selectedAssignment.value?.dateOpened || new Date();
  return new Date(dateOpened) < now.value ? t('participant-sidebar.opened') : t('participant-sidebar.open');
});

const assignmentEndDateLabel = computed(() => {
  const dateClosed = selectedAssignment.value?.dateClosed || new Date();
  return new Date(dateClosed) < now.value ? t('participant-sidebar.closed') : t('participant-sidebar.close');
});

const taskIds = computed(() => {
  return (selectedAssignment.value?.assessments ?? []).map((assessment) => assessment.taskId);
});

const tasksQueryEnabled = computed(() => !isLoadingAssignments.value && !_isEmpty(taskIds.value));

const {
  isLoading: isLoadingTasks,
  isFetching: isFetchingTasks,
  data: userTasks,
} = useTasksQuery(false, taskIds, {
  enabled: tasksQueryEnabled,
});

// Computed didn't react to selected admin changes, so using a ref instead.
let hasSurvey = ref(false);
watch(selectedAssignment, (newAdmin, oldAdmin) => {
  hasSurvey.value = newAdmin?.assessments.some((task) => task.taskId === 'survey');
  // Reset survey store when switching between different administrations
  if (newAdmin?.id !== oldAdmin?.id && oldAdmin?.id) {
    surveyStore.reset();
  }
});

const { data: surveyResponsesData } = useSurveyResponsesQuery({
  enabled: hasSurvey && initialized,
});

const isLoading = computed(() => {
  return isLoadingUserData.value || isLoadingAssignments.value || isLoadingTasks.value || isLoadingDistricts.value;
});

const isFetching = computed(() => {
  return isFetchingUserData.value || isFetchingAssignments.value || isFetchingTasks.value || isFetchingDistricts.value;
});

const hasAssignments = computed(() => {
  if (isLoading.value || isFetching.value) return false;
  return assessments.value.length > 0;
});

async function checkConsent() {
  showConsent.value = false;

  const legal = selectedAssignment.value?.legal;
  if (!legal) return;

  // Check if the user has already consented to the Levante consent form
  const consentStatus = userData.value?.legal?.consent;
  if (consentStatus) {
    return;
  }

  try {
    const consentDoc = await authStore.getLegalDoc(`${locale.value}Consent`);

    if (!consentDoc) return;

    consentType.value = toRaw(legal).consent[0].type;
    confirmText.value = consentDoc.text;
    consentVersion.value = consentDoc.version;
    showConsent.value = true;
  } catch {
    console.log('Error getting consent doc');
  }
}

async function updateConsent() {
  consentParams.value = {
    amount: selectedAssignment.value?.legal.amount,
    expectedTime: selectedAssignment.value?.legal.expectedTime,
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

const userType = computed(() => {
  return toRaw(userData.value)?.userType?.toLowerCase();
});

// Watch for when districts data changes
watch(
  districtsData,
  (newDistrictsData) => {
    if (newDistrictsData) {
      const rawDistrictsData = toRaw(newDistrictsData)?.[0];
      if (rawDistrictsData?.name) {
        logger.setAdditionalProperties({
          siteId: rawDistrictsData?.id,
          siteName: rawDistrictsData?.name,
        });
      }
    }
  },
  { immediate: true },
);

// Watch for locale changes and reset survey to allow reinitialization with new locale
watch(locale, (newLocale, oldLocale) => {
  if (newLocale !== oldLocale && surveyStore.survey) {
    surveyStore.reset();
  }
});

// Assessments to populate the game tabs.
// Generated based on the current selected administration Id
const assessments = computed(() => {
  if (!isFetching.value && selectedAssignment && (userTasks.value ?? []).length > 0) {
    const fetchedAssessments = _without(
      selectedAssignment.value.assessments.map((assessment) => {
        // Get the matching assessment from userAssignments
        const matchingAssignment = _find(userAssignments.value, {
          id: selectedAssignment.value.id,
        });
        const matchingAssessments = matchingAssignment?.assessments ?? [];
        const matchingAssessment = _find(matchingAssessments, {
          taskId: assessment.taskId,
        });

        // If no matching assessments were found, then this assessment is not assigned to the user.
        // It is in the administration but the user does not meet the conditional requirements for assignment.
        // Return undefined, which will be filtered out using lodash _without above.
        if (!matchingAssessment) return undefined;
        const optionalAssessment = _find(matchingAssessments, {
          taskId: assessment.taskId,
          optional: true,
        });
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
        return administration.id === selectedAssignment.value.id;
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

watch(userAssignmentsData, (newUserAssignmentsData) => {
  userAssignments.value = sortAssignmentsByDateOpened(newUserAssignmentsData);
});

watch(
  [userData, selectedAssignment, userAssignments],
  async ([newUserData, isSelectedAdminChanged]) => {
    // If the assignments are still loading, abort.
    if (isLoadingAssignments.value || isFetchingAssignments.value || !userAssignments.value?.length) return;

    // If the selected admin changed, ensure consent was given before proceeding.
    if (!_isEmpty(newUserData) && isSelectedAdminChanged) {
      await checkConsent();
    }

    const selectedAssignmentId = selectedAssignment.value?.id;
    const allAdminIds = userAssignments.value?.map((administration) => administration.id) ?? [];

    // Verify that we have a selected administration and it is in the list of all assigned administrations.
    if (selectedAssignmentId && allAdminIds.includes(selectedAssignmentId)) {
      // Ensure that the selected administration is a fresh instance of the administration. Whilst this seems redundant,
      // this is apparently relevant in the case that the game store does not flush properly.
      selectedAssignment.value = sortedUserAdministrations.value.find(
        (administration) => administration.id === selectedAssignmentId,
      );

      return;
    }

    // Otherwise, choose the first sorted administration if there is no selected administration.
    const chosenAssignment = sortedUserCurrentAdministrations.value[0] || sortedUserAdministrations.value[0];
    const chosenAssignmentStatus = getAssignmentStatus(chosenAssignment);

    selectedAssignment.value = chosenAssignment;
    selectedStatus.value = chosenAssignmentStatus;
  },
  { immediate: true },
);

const { data: surveyData } = useQuery({
  queryKey: ['surveys', locale.value],
  queryFn: async () => {
    const userType = userData.value.userType;

    if (userType === 'student') {
      const resSurvey = await axios.get(`${LEVANTE_BUCKET_URL}/surveys/child_survey.json`);
      const resAudio = await fetchAudioLinks('child-survey');
      surveyStore.setAudioLinkMap(resAudio);
      return {
        general: resSurvey.data,
      };
    } else if (userType === 'teacher') {
      const resGeneral = await axios.get(`${LEVANTE_BUCKET_URL}/surveys/teacher_survey_general.json`);
      const resClassroom = await axios.get(`${LEVANTE_BUCKET_URL}/surveys/teacher_survey_classroom.json`);
      return {
        general: resGeneral.data,
        specific: resClassroom.data,
      };
    } else {
      // parent
      const resFamily = await axios.get(`${LEVANTE_BUCKET_URL}/surveys/parent_survey_family.json`);
      const resChild = await axios.get(`${LEVANTE_BUCKET_URL}/surveys/parent_survey_child.json`);
      return {
        general: resFamily.data,
        specific: resChild.data,
      };
    }
  },
  enabled: userData?.value?.userType !== 'admin' && initialized && hasSurvey,
  staleTime: 24 * 60 * 60 * 1000, // 24 hours
});

const surveyDependenciesLoaded = computed(() => {
  return surveyData.value && userData.value && selectedAssignment.value && surveyResponsesData.value;
});

const specificSurveyData = computed(() => {
  if (!surveyData.value) return null;
  return userType.value === 'student' ? null : surveyData.value.specific;
});

function createSurveyInstance(surveyDataToStartAt) {
  settings.lazyRender = true;
  const surveyInstance = new Model(surveyDataToStartAt);
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

watch(
  [surveyDependenciesLoaded, selectedAssignment],
  async ([isLoaded]) => {
    // Add additional safety check to prevent race condition errors
    if (!selectedAssignment.value?.assessments) {
      console.warn('selectedAssignment or assessments not available during survey initialization');
      return;
    }

    const isAssessment = selectedAssignment.value.assessments.some((task) => task.taskId === 'survey');
    if (!isLoaded || !isAssessment || surveyStore.survey) return;

    const surveyResponseDoc = (surveyResponsesData.value || []).find(
      (doc) => doc?.administrationId === selectedAssignment.value?.id,
    );
    let shouldInitializeSurvey = true;

    // Calculate number of specific surveys for teachers/parents
    const numOfSpecificSurveys =
      userType.value === 'parent' ? userData.value?.childIds?.length : userData.value?.classes?.current?.length;

    if (surveyResponseDoc) {
      if (userType.value === 'student') {
        const isComplete = surveyResponseDoc.general.isComplete;
        surveyStore.setIsGeneralSurveyComplete(isComplete);
        if (isComplete) {
          shouldInitializeSurvey = false;
        }
      } else {
        surveyStore.setIsGeneralSurveyComplete(surveyResponseDoc.general.isComplete);

        if (surveyResponseDoc.specific && surveyResponseDoc.specific.length > 0) {
          if (
            surveyResponseDoc.specific.length === numOfSpecificSurveys &&
            surveyResponseDoc.specific.every((relation) => relation.isComplete)
          ) {
            surveyStore.setIsSpecificSurveyComplete(true);
            shouldInitializeSurvey = false;
          } else {
            const incompleteIndex = surveyResponseDoc.specific.findIndex((relation) => !relation.isComplete);
            if (incompleteIndex > -1) {
              surveyStore.setSpecificSurveyRelationIndex(incompleteIndex);
            } else {
              surveyStore.setSpecificSurveyRelationIndex(surveyResponseDoc.specific.length);
            }
          }
        }

        // Check if both general and specific surveys are complete
        if (
          surveyResponseDoc.general.isComplete &&
          surveyResponseDoc.specific?.length === numOfSpecificSurveys &&
          surveyResponseDoc.specific?.every((relation) => relation.isComplete)
        ) {
          shouldInitializeSurvey = false;
        }
      }
    }

    if (!shouldInitializeSurvey) return;

    // Fetch child docs for parent or class docs for teacher
    if (userType.value === 'parent' || userType.value === 'teacher') {
      try {
        let fetchConfig = [];
        // Only fetch docs if the user has children or classes. It's possible the user has no children or classes linked yet.
        if (userType.value === 'parent' && userData.value.childIds) {
          fetchConfig = userData.value.childIds.map((childId) => ({
            collection: 'users',
            docId: childId,
            select: ['birthMonth', 'birthYear'],
          }));
        } else if (userType.value === 'teacher' && userData.value.classes?.current) {
          fetchConfig = userData.value.classes.current.map((classId) => ({
            collection: 'classes',
            docId: classId,
            select: ['name'],
          }));
        }

        if (fetchConfig.length > 0) {
          const res = await fetchDocsById(fetchConfig);
          surveyStore.setSpecificSurveyRelationData(res);
        }
      } catch (error) {
        console.error('Error fetching relation data:', error);
      }
    }

    const surveyDataToStartAt =
      userType.value === 'student' || !surveyStore.isGeneralSurveyComplete
        ? surveyData.value.general
        : surveyData.value.specific;

    const surveyInstance = createSurveyInstance(surveyDataToStartAt);
    setupMarkdownConverter(surveyInstance);

    await initializeSurvey({
      surveyInstance,
      userType: userType.value,
      specificSurveyData: specificSurveyData.value,
      userData: userData.value,
      surveyStore,
      locale: locale.value,
      audioLinkMap: surveyStore.audioLinkMap,
      generalSurveyData: surveyData.value.general,
    });

    setupSurveyEventHandlers({
      surveyInstance,
      userType: userType.value,
      roarfirekit: roarfirekit.value,
      uid: userData.value.id,
      selectedAdminId: selectedAssignment.value?.id,
      surveyStore,
      router,
      toast,
      queryClient,
      userData: userData.value,
      assignmentsStore,
    });

    surveyStore.setSurvey(surveyInstance);
  },
  { immediate: true },
);
</script>
<style lang="scss" scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.assignment {
  display: block;
  width: 100%;
  height: auto;
  margin: 0;
  padding: 2rem;
}

.assignment__status {
  &.--current {
    background: rgba(var(--bright-green-rgb), 0.1);
    color: var(--bright-green);
  }

  &.--upcoming {
    background: rgba(var(--bright-yellow-rgb), 0.1);
    color: var(--bright-yellow);
  }

  &.--past {
    background: rgba(var(--bright-red-rgb), 0.1);
    color: var(--bright-red);
  }
}

.assignment__name {
  display: block;
  margin: 0.5rem 0 0;
  font-weight: 700;
  font-size: 1.5rem;
  color: var(--gray-600);

  @media (max-width: 1024px) {
    font-size: 1.35rem;
  }
}

.assignment__dates,
.assignment__date {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0 0;
}

.assignment__date {
  gap: 0.25rem;
  margin: 0;
  font-weight: 500;
  color: var(--gray-500);

  .pi {
    margin: -2px 0 0;
  }
}

.assignment__main {
  display: flex;
  gap: 2rem;
  width: 100%;
  height: auto;
  margin: 2rem 0 0;
}

.tabs-container {
  display: block;
  // 100% - (side chart width) - (parent gap)
  width: calc(100% - 200px - 2rem);
  height: auto;
  margin: 0;
  padding: 0;
}

.assignment-select-container {
  min-width: 100%;
}

.switch-container {
  min-width: 24%;
}
</style>
