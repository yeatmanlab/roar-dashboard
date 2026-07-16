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
import { getRoarApiClient } from '@/clients/roar-api';
import useUserStudentDataQuery from '@/composables/queries/useUserStudentDataQuery';
import { version } from '@roar-platform/roav-apps/package.json';

const props = defineProps({
  taskId: { type: String, default: 'roav-mp' },
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
    TaskLauncher = (await import('@roar-platform/roav-apps')).TaskLauncher;
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

    const roarApiClient = getRoarApiClient();

    const [taskRes, meRes] = await Promise.all([
      roarApiClient.tasks.get({ params: { taskId: props.taskId } }),
      roarApiClient.me.get(),
    ]);

    if (taskRes.status !== 200) {
      throw new Error(`roav-apps task "${props.taskId}" not found in the ROAR backend (status ${taskRes.status}).`);
    }
    if (meRes.status !== 200) {
      throw new Error(`Failed to resolve current user from the ROAR backend (status ${meRes.status}).`);
    }

    // Proxy-launch path (launchId set) requires resolving the participant's Postgres UUID from
    // the launch record — props.launchId is an assignment/launch ID, not a user ID. Passing it
    // as participantId would silently create runs under the wrong ID. Fail loudly until this
    // is properly implemented.
    if (props.launchId) {
      throw new Error(
        'Proxy-launch path is not yet supported for roav-apps tasks. Resolve the participant Postgres UUID before enabling this path.',
      );
    }
    const participantId = meRes.body.data.id;

    const adminsRes = await roarApiClient.users.listUserAdministrations({
      params: { userId: participantId },
      query: { embed: 'tasks', perPage: 50 },
    });

    if (adminsRes.status !== 200) {
      throw new Error(`Failed to fetch administrations from the ROAR backend (status ${adminsRes.status}).`);
    }

    const roavTaskUuid = taskRes.body.data.id;
    const backendAdmins = adminsRes.body.data.items;

    const matchedAdmin =
      backendAdmins.find((a) => a.id === selectedAdmin.value.id) ??
      backendAdmins.find((a) => (a.tasks ?? []).some((t) => t.taskId === roavTaskUuid));

    if (!matchedAdmin) {
      throw new Error(`No administration containing the "${props.taskId}" task found in the ROAR backend.`);
    }

    const roavTaskVariant = (matchedAdmin.tasks ?? []).find((t) => t.taskId === roavTaskUuid);
    if (!roavTaskVariant) {
      throw new Error(`No task variant for "${props.taskId}" found in the matched administration.`);
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
        variantId: roavTaskVariant.variantId,
        taskVersion: version,
        administrationId: matchedAdmin.id,
        isAnonymous: false,
      },
    );

    const { variantParams } = await getVariantById(roavTaskVariant.variantId);

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
