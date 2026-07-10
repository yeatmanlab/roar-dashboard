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
import { getRoarApiClient } from '@/clients/roar-api';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roar-readaloud/package.json';

const props = defineProps({
  taskId: { type: String, default: READALOUD_TASK_ID },
  language: { type: String, default: 'en' },
  launchId: { type: String, default: null },
});

let TaskLauncher;

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

onMounted(async () => {
  try {
    TaskLauncher = (await import('@roar-platform/roar-readaloud')).default;
  } catch (error) {
    console.error('An error occurred while importing the game module.', error);
  }

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
    // Resolve the task UUID and the current user's Postgres UUID, then match the selected
    // administration and its read-aloud variant before initializing the SDK compat facade.
    //
    // NOTE: Until the dashboard migrates its administration queries to the new REST API,
    // selectedAdmin.value.id is a Firestore document ID and will not match any administration
    // in the new backend. The fallback (matching by task UUID within embedded tasks) is used
    // until that migration is complete.
    const roarApiClient = getRoarApiClient();

    const [taskRes, meRes] = await Promise.all([
      roarApiClient.tasks.get({ params: { taskId: props.taskId } }),
      roarApiClient.me.get(),
    ]);

    if (taskRes.status !== 200) {
      throw new Error(`read-aloud task not found in the ROAR backend (status ${taskRes.status}).`);
    }
    if (meRes.status !== 200) {
      throw new Error(`Failed to resolve current user from the ROAR backend (status ${meRes.status}).`);
    }

    // Proxy-launch path (launchId set) requires resolving the participant's Postgres UUID from
    // the launch record — props.launchId is an assignment/launch ID, not a user ID. Fail loudly
    // until this is properly implemented.
    if (props.launchId) {
      throw new Error(
        'Proxy-launch path is not yet supported for Read Aloud. Resolve the participant Postgres UUID before enabling this path.',
      );
    }
    const participantId = meRes.body.data.id;

    // Fetch the participant's administrations from the ROAR Postgres backend.
    const adminsRes = await roarApiClient.users.listUserAdministrations({
      params: { userId: participantId },
      query: { embed: 'tasks', perPage: 50 },
    });

    if (adminsRes.status !== 200) {
      throw new Error(`Failed to fetch administrations from the ROAR backend (status ${adminsRes.status}).`);
    }

    const taskUuid = taskRes.body.data.id;
    const backendAdmins = adminsRes.body.data.items;

    // TODO: Remove this matching step once the frontend has fully integrated with the ROAR Postgres backend.
    // Until then, match the Postgres backend admin to the selected admin from Firestore.
    // ISSUE: https://github.com/yeatmanlab/roar-project-management/issues/1839
    const matchedAdmin =
      backendAdmins.find((a) => a.id === selectedAdmin.value.id) ??
      backendAdmins.find((a) => (a.tasks ?? []).some((t) => t.taskId === taskUuid));

    if (!matchedAdmin) {
      throw new Error('No administration containing the read-aloud task found in the ROAR backend.');
    }

    const taskVariant = (matchedAdmin.tasks ?? []).find((t) => t.taskId === taskUuid);
    if (!taskVariant) {
      throw new Error('No read-aloud task variant found in the matched administration.');
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
        administrationId: matchedAdmin.id,
        isAnonymous: false,
      },
    );

    // Source the variant parameters from the assessment SDK now that initFirekitCompat has run.
    const { variantParams } = await getVariantById(taskVariant.variantId);
    const gameParams = { ...variantParams };

    // Read Aloud drives its own DOM (no jsPsych target div) and takes a session object as the
    // third constructor arg. assessmentUid seeds the recording storage-path segment; there is no
    // operator-entered participant ID on the dashboard path, so assessmentPid stays empty.
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
