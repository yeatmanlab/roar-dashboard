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
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { SURVEY_TASK_ID } from '@roar-platform/assessment-schema/roar-survey';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { getRoarApiClient } from '@/clients/roar-api';
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
const { isAuthReady } = storeToRefs(authStore);

const sdkInitialized = ref(false);
const surveyJson = ref(null);
const taskStarted = ref(false);

let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
};
const handlePopState = () => router.go(0);

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.accessToken) init();
});

window.addEventListener('popstate', handlePopState, { once: true });

onMounted(async () => {
  if (authStore.isAuthReady) init();
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

watch(
  [isAuthReady],
  async ([newIsAuthReady]) => {
    if (newIsAuthReady && !taskStarted.value) {
      taskStarted.value = true;
      const { selectedAdmin } = storeToRefs(gameStore);
      await startTask(selectedAdmin);
    }
  },
  { immediate: true },
);

async function startTask(selectedAdmin) {
  try {
    // The participant's administrations — each with its tasks' `variantId` embedded — are
    // already fetched by HomeParticipant via
    // `GET /users/:userId/administrations?embed=tasks,progress`, and the chosen one is held
    // in the game store. The administration and variant are therefore read from
    // `selectedAdmin` rather than re-fetched here.
    const roarApiClient = getRoarApiClient();
    const meRes = await roarApiClient.me.get();

    if (meRes.status !== 200)
      throw new Error(`Failed to resolve current user from ROAR backend (status ${meRes.status}).`);

    // Proxy-launch path: `props.launchId` is the participant's ROAR (Postgres) user UUID
    // (set by StudentCardSimple when a parent launches a child), so it is the participant
    // identity directly. On the self path (`launchId` null) we use the launching user's own
    // `/me` ID. Run creation targets this participant via POST /v1/user/:userId/runs, which
    // the backend authorizes with `can_create_run_for_child` (proxy) or self.
    const participantId = props.launchId ?? meRes.body.data.id;

    // An administration's embedded tasks carry the catalog `taskSlug`, which is what the
    // router passes as `taskId` — GameTabs routes to `/game/<slug>` (see `participantGames.toGame`).
    const administration = selectedAdmin.value;
    const surveyTaskVariant = (administration?.tasks ?? []).find((task) => task.taskSlug === props.taskId);

    if (!surveyTaskVariant) throw new Error(`No ${props.taskId} task variant found in the selected administration.`);

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
        administrationId: administration.id,
        isAnonymous: false,
      },
    );

    // Source the survey's variant parameters from the assessment SDK now that
    // initFirekitCompat has run. The seeded variant carries the required `survey`
    // key (the GCS filename), which getVariantById round-trips verbatim.
    const { variantParams } = await getVariantById(surveyTaskVariant.variantId);
    const gameParams = { ...variantParams };

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
