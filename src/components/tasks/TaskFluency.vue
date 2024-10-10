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
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import _get from 'lodash/get';
import { fetchDocById } from '@/helpers/query/utils';
import packageLockJson from '../../../package-lock.json';

const props = defineProps({
  taskId: { type: String, default: 'fluency-arf' },
  language: { type: String, default: 'en' },
});

let TaskLauncher;

const taskId = props.taskId;
const { version } = packageLockJson.packages['node_modules/@bdelab/roam-fluency'];
const router = useRouter();
const gameStarted = ref(false);
const authStore = useAuthStore();
const gameStore = useGameStore();
const { isFirekitInit, roarfirekit, roarUid } = storeToRefs(authStore);

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
  if (state.roarfirekit.restConfig) init();
});

const { isLoading: isLoadingUserData, data: userData } = useQuery({
  queryKey: ['userData', roarUid, 'studentData'],
  queryFn: () => fetchDocById('users', roarUid.value, ['studentData']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
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
    TaskLauncher = (await import('@bdelab/roam-fluency')).default;
  } catch (error) {
    console.error('An error occurred while importing the game module.', error);
  }

  if (roarfirekit.value.restConfig) init();
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState);
});

watch(
  [isFirekitInit, isLoadingUserData],
  async ([newFirekitInitValue, newLoadingUserData]) => {
    if (newFirekitInitValue && !newLoadingUserData) await startTask();
  },
  { immediate: true },
);

const { selectedAdmin } = storeToRefs(gameStore);

async function startTask() {
  try {
    let checkGameStarted = setInterval(function () {
      // Poll for the preload trials progress bar to exist and then begin the game
      let gameLoading = document.querySelector('.jspsych-content-wrapper');
      if (gameLoading) {
        gameStarted.value = true;
        clearInterval(checkGameStarted);
      }
    }, 100);

    const appKit = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId, version);

    const userDob = _get(userData.value, 'studentData.dob');
    const userDateObj = new Date(userDob);

    const userParams = {
      grade: _get(userData.value, 'studentData.grade'),
      birthMonth: userDateObj.getMonth() + 1,
      birthYear: userDateObj.getFullYear(),
      language: props.language,
    };

    const gameParams = { ...appKit._taskInfo.variantParams };

    const roarApp = new TaskLauncher(appKit, gameParams, userParams, 'jspsych-target');

    await roarApp.run().then(async () => {
      // Handle any post-game actions.
      await authStore.completeAssessment(selectedAdmin.value.id, taskId);

      // Navigate to home, but first set the refresh flag to true.
      gameStore.requireHomeRefresh();
      router.push({ name: 'Home' });
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
@import '@bdelab/roam-fluency/lib/resources/roam-fluency.css';

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
