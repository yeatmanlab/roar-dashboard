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
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import useParticipantId from '@/composables/useParticipantId';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roav-apps/package.json';

const props = defineProps({
  taskId: { type: String, default: 'roav-mp' },
  launchId: { type: String, default: null },
});

// Start loading the assessment bundle at setup rather than in onMounted. The
// watcher below runs with `immediate: true`, so startTask can execute during
// setup — before onMounted would have assigned the launcher.
const taskLauncherPromise = import('@roar-platform/roav-apps').then((module) => module.TaskLauncher);
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
      // Poll for the jsPsych content wrapper to exist and then begin the game
      let gameLoading = document.querySelector('.jspsych-content-wrapper');
      if (gameLoading) {
        gameStarted.value = true;
        clearInterval(checkGameStarted);
      }
    }, 100);

    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = new Date(userDob);

    const userParams = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj.getMonth() + 1,
      birthYear: userDateObj.getFullYear(),
    };

    // An administration's embedded tasks carry the catalog `taskSlug`, which is what the
    // router passes as `taskId` — GameTabs routes to `/game/<slug>` (see `participantGames.toGame`).
    const administration = selectedAdmin.value;
    const roavTaskVariant = (administration?.tasks ?? []).find((task) => task.taskSlug === props.taskId);

    if (!roavTaskVariant) {
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
        variantId: roavTaskVariant.variantId,
        taskVersion: version,
        administrationId: administration.id,
        isAnonymous: false,
      },
    );

    const { variantParams } = await getVariantById(roavTaskVariant.variantId);

    const TaskLauncher = await taskLauncherPromise;

    const roarApp = new TaskLauncher(variantParams, userParams);

    await roarApp.run().then(() => {
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
