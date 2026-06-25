<template>
  <div v-if="!sdkInitialized || !surveyJson" class="text-center col-full">
    <h1>{{ $t('tasks.preparing') }}</h1>
    <AppSpinner />
  </div>
  <SurveyRunner v-else :survey-data="surveyJson" @complete-survey="handleCompleteSurvey" />
</template>

<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { SURVEY_TASK_ID } from '@roar-platform/assessment-schema/roar-survey';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { getRoarApiClient } from '@/clients/roar-api';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roar-survey/package.json';
import SurveyRunner from '@roar-platform/roar-survey';

const props = defineProps({
  taskId: { type: String, default: SURVEY_TASK_ID },
  language: { type: String, default: 'en' },
  launchId: { type: String, default: null },
});

const router = useRouter();
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isFirekitInit } = storeToRefs(authStore);

const sdkInitialized = ref(false);
const surveyJson = ref(null);
const taskStarted = ref(false);

const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};
const handlePopState = () => router.go(0);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.accessToken) init();
});

const { isLoading: isLoadingUserData } = useUserStudentDataQuery(props.launchId, {
  enabled: initialized,
});

window.addEventListener('popstate', handlePopState, { once: true });

onMounted(async () => {
  if (authStore.isAuthReady) init();
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

watch(
  [isFirekitInit, isLoadingUserData],
  async ([newFirekitInitValue, newLoadingUserData]) => {
    if (newFirekitInitValue && !newLoadingUserData && !taskStarted.value) {
      taskStarted.value = true;
      const { selectedAdmin } = storeToRefs(gameStore);
      await startTask(selectedAdmin);
    }
  },
  { immediate: true },
);

async function startTask(selectedAdmin) {
  try {
    const appKit = await authStore.roarfirekit.startAssessment(
      selectedAdmin.value.id,
      props.taskId,
      version,
      props.launchId,
    );

    const gameParams = { ...appKit._taskInfo.variantParams };

    if (props.launchId) {
      throw new Error(
        'Proxy-launch path is not yet supported for roar-survey. Resolve the participant Postgres UUID before enabling this path.',
      );
    }

    const roarApiClient = getRoarApiClient();
    const [taskRes, meRes] = await Promise.all([
      roarApiClient.tasks.get({ params: { taskId: props.taskId } }), // tasks.get accepts UUID or slug
      roarApiClient.me.get(),
    ]);

    if (taskRes.status !== 200)
      throw new Error(`roar-survey task not found in ROAR backend (status ${taskRes.status}).`);
    if (meRes.status !== 200)
      throw new Error(`Failed to resolve current user from ROAR backend (status ${meRes.status}).`);

    const participantId = meRes.body.data.id;
    const surveyTaskUuid = taskRes.body.data.id;

    const adminsRes = await roarApiClient.users.listUserAdministrations({
      params: { userId: participantId },
      query: { embed: 'tasks', perPage: 50 },
    });

    if (adminsRes.status !== 200) throw new Error(`Failed to fetch administrations (status ${adminsRes.status}).`);

    const backendAdmins = adminsRes.body.data.items;
    const matchedAdmin =
      backendAdmins.find((a) => a.id === selectedAdmin.value.id) ??
      backendAdmins.find((a) => (a.tasks ?? []).some((t) => t.taskId === surveyTaskUuid));

    if (!matchedAdmin) throw new Error('No administration containing roar-survey found in ROAR backend.');

    const surveyTaskVariant = (matchedAdmin.tasks ?? []).find((t) => t.taskId === surveyTaskUuid);
    if (!surveyTaskVariant) throw new Error('No roar-survey task variant found in the matched administration.');

    initFirekitCompat(
      {
        baseUrl: import.meta.env.VITE_ROAR_API_BASE_URL,
        auth: {
          getToken: () => Promise.resolve(authStore.accessToken),
          refreshToken: () => authStore.forceIdTokenRefresh(),
        },
        participant: { participantId },
      },
      {
        variantId: surveyTaskVariant.variantId,
        taskVersion: version,
        administrationId: matchedAdmin.id,
        isAnonymous: false,
      },
    );

    // Fetch survey JSON from GCS using the survey file name from variant params.
    // The bucket URL matches src/constants/bucketBaseUrl.js in the assessment source.
    const surveyFile = gameParams.survey ?? 'survey';
    const bucketUrl = `https://storage.googleapis.com/roar-survey-app/${props.language}/`;
    const response = await fetch(`${bucketUrl}${surveyFile}.json`);
    if (!response.ok) throw new Error(`Survey fetch failed: ${response.statusText}`);
    surveyJson.value = await response.json();

    sdkInitialized.value = true;
  } catch (error) {
    console.error('An error occurred while starting the task:', error);
    alert(
      'An error occurred while starting the task. Please refresh the page and try again. If the error persists, please submit an issue report.',
    );
  }
}

function handleCompleteSurvey() {
  try {
    gameStore.requireHomeRefresh();
    if (props.launchId) {
      router.push({ name: 'LaunchParticipant', params: { launchId: props.launchId } });
    } else {
      router.push({ name: 'Home' });
    }
  } catch (error) {
    console.error('An error occurred while completing the survey:', error);
    alert(
      'An error occurred while completing the survey. Please refresh the page and try again. If the error persists, please submit an issue report.',
    );
  }
}
</script>

<style>
@import '@roar-platform/roar-survey/lib/roar-survey.css';
.sd-root-modern__wrapper {
  margin: auto;
}
</style>
