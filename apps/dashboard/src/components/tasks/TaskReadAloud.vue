<template>
  <div translate="no" />
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
import { READALOUD_TASK_ID } from '@roar-platform/assessment-schema/roar-readaloud';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useParticipantId from '@/composables/useParticipantId';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roar-readaloud/package.json';

const props = defineProps({
  taskId: { type: String, default: READALOUD_TASK_ID },
  language: { type: String, default: 'en' },
  launchId: { type: String, default: null },
});

// Start loading the assessment bundle at setup rather than in onMounted. The
// watcher below runs with `immediate: true`, so startTask can execute during
// setup — before onMounted would have assigned the launcher.
const taskLauncherPromise = import('@roar-platform/roar-readaloud').then((module) => module.default);
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

// Resolves the proxy-launch id or the launching user's own `/me` id. The student-data query
// below is gated on it because `useUserStudentDataQuery` falls back to the Firestore
// `authStore.roarUid` for a falsy argument, which the uuid-typed `GET /users/:id` rejects.
const participantId = useParticipantId(props.launchId);

const { isLoading: isLoadingUserData, data: userData } = useUserStudentDataQuery(participantId, {
  enabled: computed(() => initialized.value && Boolean(participantId.value)),
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
  [isAuthReady, isLoadingUserData, participantId],
  async ([newIsAuthReady, newLoadingUserData, newParticipantId]) => {
    // `participantId` is part of the gate because a disabled student-data query reports
    // `isLoading === false` — on its own it would let the task start before the id resolves.
    if (newIsAuthReady && !newLoadingUserData && newParticipantId && !taskStarted.value) {
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
      // Poll for the first read-aloud view (bootstrap card) to render, then hide the spinner.
      let gameLoading = document.querySelector('.card-title');
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
      language: props.language,
    };

    // Initialize the new assessment SDK for the dashboard execution path (mirrors TaskMultichoice).
    //
    // The participant's administrations — each with its tasks' `variantId` embedded —
    // are already fetched by HomeParticipant via
    // `GET /users/:userId/administrations?embed=tasks,progress`, and the chosen one is
    // held in the game store. The administration and variant are therefore read from
    // `selectedAdmin` rather than re-fetched here.
    //
    // An administration's embedded tasks carry the catalog `taskSlug`, which is what the
    // router passes as `taskId` — GameTabs routes to `/game/<slug>` (see `participantGames.toGame`).
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
        participant: { participantId: participantId.value },
      },
      {
        variantId: taskVariant.variantId,
        taskVersion: version,
        administrationId: administration.id,
        isAnonymous: false,
      },
    );

    // Source the variant parameters from the assessment SDK now that initFirekitCompat has run.
    const { variantParams } = await getVariantById(taskVariant.variantId);
    const gameParams = { ...variantParams };

    // Read Aloud drives its own DOM (no jsPsych target div) and takes a session object as the
    // third constructor arg. assessmentUid seeds the recording storage-path segment; there is no
    // operator-entered participant ID on the dashboard path, so assessmentPid stays empty.
    const TaskLauncher = await taskLauncherPromise;

    const roarApp = new TaskLauncher(gameParams, userParams, {
      assessmentPid: '',
      assessmentUid: participantId,
    });

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
