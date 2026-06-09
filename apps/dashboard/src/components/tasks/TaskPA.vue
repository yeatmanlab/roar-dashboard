<template>
  <div id="jspsych-target" class="game-target" translate="no" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>{{ $t('tasks.preparing') }}</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import { onMounted, watch, ref, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import _get from 'lodash/get';
import { initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { PA_TASK_ID } from '@roar-platform/assessment-schema/roar-pa';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { getRoarApiClient } from '@/clients/roar-api';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roar-pa/package.json';

const props = defineProps({
  taskId: { type: String, default: PA_TASK_ID },
  language: { type: String, default: 'en' },
  launchId: { type: String, default: null },
});

let TaskLauncher;

const taskId = props.taskId;
const router = useRouter();
const taskStarted = ref(false);
const gameStarted = ref(false);
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isFirekitInit, roarfirekit } = storeToRefs(authStore);

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
  if (state.roarfirekit.restConfig?.()) init();
});

const { isLoading: isLoadingUserData, data: userData } = useUserStudentDataQuery(props.launchId, {
  enabled: initialized,
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

onMounted(async () => {
  try {
    TaskLauncher = (await import('@roar-platform/roar-pa')).default;
  } catch (error) {
    console.error('An error occurred while importing the game module.', error);
  }

  if (roarfirekit.value.restConfig?.()) init();
});

// Declare interval at component scope
let checkGameStarted;

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
  if (checkGameStarted) clearInterval(checkGameStarted);
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

    const appKit = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId, version, props.launchId);

    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = new Date(userDob);

    const userParams = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj.getMonth() + 1,
      birthYear: userDateObj.getFullYear(),
      language: props.language,
    };

    const gameParams = { ...appKit._taskInfo.variantParams };

    // Initialize the new assessment SDK for the dashboard execution path.
    // Fetches the PA task UUID, the current user's Postgres UUID, and the participant's
    // administrations in parallel to resolve the correct administrationId and variantId.
    //
    // authStore.roarUid is a Firestore UID, not a Postgres UUID. GET /me resolves the
    // Postgres UUID for the currently authenticated user (self-launch path).
    // TODO: resolve the participant's Postgres UUID for the proxy-launch path (launchId set).
    //
    // NOTE: Until the dashboard migrates its administration queries to the new REST API,
    // selectedAdmin.value.id is a Firestore document ID and will not match any administration
    // in the new backend. The fallback (matching by PA task UUID within embedded tasks)
    // is used until that migration is complete.
    const roarApiClient = getRoarApiClient();

    const [taskRes, meRes] = await Promise.all([
      roarApiClient.tasks.get({ params: { taskId: props.taskId } }),
      roarApiClient.me.get(),
    ]);

    if (taskRes.status !== 200) {
      throw new Error(`pa task not found in the ROAR backend (status ${taskRes.status}).`);
    }
    if (meRes.status !== 200) {
      throw new Error(`Failed to resolve current user from the ROAR backend (status ${meRes.status}).`);
    }

    // Use the Postgres UUID from /me for self-launch; launchId for proxy-launch (admin-initiated).
    // TODO: resolve participant's Postgres UUID when launchId is set.
    const participantId = props.launchId ?? meRes.body.data.id;

    // Fetch the participant's administrations from the ROAR POSTGRES backend.
    const adminsRes = await roarApiClient.users.listUserAdministrations({
      params: { userId: participantId },
      query: { embed: 'tasks', perPage: 50 },
    });

    if (adminsRes.status !== 200) {
      throw new Error(`Failed to fetch administrations from the ROAR backend (status ${adminsRes.status}).`);
    }

    const paTaskUuid = taskRes.body.data.id;
    const backendAdmins = adminsRes.body.data.items;

    // TODO: Remove this matching step once the frontend has fully integrated with the ROAR POSTGRES backend.
    // Until then, we need to match the Postgres backend admin to the selected admin from Firestore.
    // ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1839
    const matchedAdmin =
      backendAdmins.find((a) => a.id === selectedAdmin.value.id) ??
      backendAdmins.find((a) => (a.tasks ?? []).some((t) => t.taskId === paTaskUuid));

    if (!matchedAdmin) {
      throw new Error('No administration containing the pa task found in the ROAR backend.');
    }

    const paTaskVariant = (matchedAdmin.tasks ?? []).find((t) => t.taskId === paTaskUuid);
    if (!paTaskVariant) {
      throw new Error('No pa task variant found in the matched administration.');
    }

    initFirekitCompat(
      {
        baseUrl: import.meta.env.VITE_ROAR_API_BASE_URL,
        auth: { getToken: () => Promise.resolve(authStore.accessToken) },
        participant: { participantId },
      },
      {
        variantId: paTaskVariant.variantId,
        taskVersion: version,
        administrationId: matchedAdmin.id,
        isAnonymous: false,
      },
    );

    const roarApp = new TaskLauncher(gameParams, userParams, 'jspsych-target');

    await roarApp.run().then(async () => {
      // Handle any post-game actions.
      await authStore.completeAssessment(selectedAdmin.value.id, taskId, props.launchId);

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
