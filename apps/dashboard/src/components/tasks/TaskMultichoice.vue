<template>
  <div id="jspsych-target" class="game-target" translate="no" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>{{ $t('tasks.preparing') }}</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import { onMounted, watch, ref, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import { getVariantById, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { MORPHOLOGY_TASK_ID } from '@roar-platform/assessment-schema/roar-multichoice';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { getRoarApiClient } from '@/clients/roar-api';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roar-multichoice/package.json';

const props = defineProps({
  taskId: { type: String, default: MORPHOLOGY_TASK_ID },
  // Multichoice is currently English-only; the game resolves locale via i18next rather than
  // a variant param. If language support is added, thread props.language into gameParams here
  // (e.g. { language: props.language, task: props.task, ...variantParams })
  // and add "language" to the variant params in taskVariantParameters.example.json.
  language: { type: String, default: 'en' },
  task: { type: String, default: 'morphology' },
  launchId: { type: String, default: null },
});

// Start loading the assessment bundle at setup rather than in onMounted. The
// watcher below runs with `immediate: true`, so startTask can execute during
// setup — before onMounted would have assigned the launcher.
const taskLauncherPromise = import('@roar-platform/roar-multichoice').then((module) => module.default);
// Mark the rejection handled so a failed import doesn't log `Uncaught (in promise)`
// during the gap before startTask awaits it — that await still rejects into its catch.
taskLauncherPromise.catch(() => {});

const router = useRouter();
const taskStarted = ref(false);
const gameStarted = ref(false);
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isAuthReady } = storeToRefs(authStore);

const initialized = ref(false);
let unsubscribe;
const init = () => {
  if (unsubscribe) unsubscribe();
  initialized.value = true;
};
const handlePopState = () => {
  router.go(0);
};

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.accessToken) init();
});

// launchId path throws immediately in startTask (proxy-launch not yet supported),
// so skip the query entirely when launchId is set to avoid a pointless loading delay.
const { isLoading: isLoadingUserData, data: userData } = useUserStudentDataQuery(props.launchId, {
  enabled: computed(() => initialized.value && !props.launchId),
});

// The following code intercepts the back button and instead forces a refresh.
// We add { once: true } to prevent an infinite loop.
window.addEventListener(
  'popstate',
  () => {
    handlePopState();
  },
  { once: true },
);

onMounted(() => {
  if (authStore.isAuthReady) init();
});

// Declare interval at component scope
let checkGameStarted;

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
  if (checkGameStarted) clearInterval(checkGameStarted);
});

watch(
  [isAuthReady, isLoadingUserData],
  async ([newIsAuthReady, newLoadingUserData]) => {
    if (newIsAuthReady && !newLoadingUserData && !taskStarted.value) {
      taskStarted.value = true;
      const { selectedAdmin } = storeToRefs(gameStore);
      await startTask(selectedAdmin);
    }
  },
  { immediate: true },
);

async function startTask(selectedAdmin) {
  try {
    // Move interval to component scope for cleanup
    if (checkGameStarted) clearInterval(checkGameStarted);
    checkGameStarted = setInterval(function () {
      // Poll for the preload trials progress bar to exist and then begin the game
      let gameLoading = document.querySelector('.jspsych-content-wrapper');
      if (gameLoading) {
        gameStarted.value = true;
        clearInterval(checkGameStarted);
      }
    }, 100);

    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = userDob ? new Date(userDob) : null;

    const userParams = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj ? userDateObj.getMonth() + 1 : undefined,
      birthYear: userDateObj ? userDateObj.getFullYear() : undefined,
    };

    // Initialize the new assessment SDK for the dashboard execution path.
    //
    // The participant's administrations — each with its tasks' `variantId` embedded —
    // are already fetched by HomeParticipant via
    // `GET /users/:userId/administrations?embed=tasks,progress`, and the chosen one is
    // held in the game store. The administration and variant are therefore read from
    // `selectedAdmin` rather than re-fetched here.
    //
    // authStore.roarUid is a Firestore UID, not a Postgres UUID. GET /me resolves the
    // Postgres UUID for the currently authenticated user (self-launch path); the
    // proxy-launch path uses props.launchId directly (see below).
    const roarApiClient = getRoarApiClient();

    const meRes = await roarApiClient.me.get();

    if (meRes.status !== 200) {
      throw new Error(`Failed to resolve current user from the ROAR backend (status ${meRes.status}).`);
    }

    // Proxy-launch path: `props.launchId` is the participant's ROAR (Postgres) user UUID
    // (set by StudentCardSimple when a parent launches a child), so it is the participant
    // identity directly. On the self path (`launchId` null) we use the launching user's own
    // `/me` ID. Run creation targets this participant via POST /v1/user/:userId/runs, which
    // the backend authorizes with `can_create_run_for_child` (proxy) or self.
    const participantId = props.launchId ?? meRes.body.data.id;

    // An administration's embedded tasks carry the catalog `taskSlug`, which is what the
    // router passes as `taskId` — GameTabs routes to `/game/<slug>`.
    const administration = selectedAdmin.value;
    const taskVariant = (administration?.tasks ?? []).find((task) => task.taskSlug === props.taskId);

    if (!taskVariant) {
      throw new Error(`No ${props.taskId} task variant found in the selected administration.`);
    }

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
        variantId: taskVariant.variantId,
        taskVersion: version,
        administrationId: administration.id,
        isAnonymous: false,
      },
    );

    // Source the variant parameters from the assessment SDK now that initFirekitCompat has run.
    // variantParams.task (from the DB variant) is the authoritative source for the task mode
    // (morphology vs. cva); props.task is the fallback for variants that predate the task field.
    const { variantParams } = await getVariantById(taskVariant.variantId);
    const gameParams = { task: props.task, ...variantParams };

    const TaskLauncher = await taskLauncherPromise;

    const roarApp = new TaskLauncher(gameParams, userParams, 'jspsych-target');

    await roarApp.run().then(() => {
      // Navigate to home, but first set the refresh flag to true.
      gameStore.requireHomeRefresh();
      if (props.launchId) {
        router.push({ name: 'LaunchParticipant', params: { launchId: props.launchId } });
      } else {
        router.push({ name: 'Home' });
      }
    });
  } catch (error) {
    console.error('An error occurred while starting the task:', error);
    alert(
      'An error occurred while starting the task. Please refresh the page and try again. If the error persists, please submit an issue report.',
    );
  }
}
</script>
<style>
.game-target {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.game-target:focus {
  outline: none;
}
</style>

<style scoped>
:deep(p.speechbubble-text-morphology),
:deep(p.mid-centered-text),
:deep(div#jspsych-audio-multi-response-prompt > p.item-stimulus) {
  line-height: inherit;
}
</style>
