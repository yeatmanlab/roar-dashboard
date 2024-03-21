<template>
  <div id="jspsych-target" class="game-target" translate="no" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>{{ $t('tasks.preparing') }}</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import { onMounted, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import _get from 'lodash/get';
import { fetchDocById } from '@/helpers/query/utils';

const props = defineProps({
  taskId: { type: String, default: 'multichoice' },
  language: { type: String, default: 'en' },
});

let TaskLauncher;

const task = '@bdelab/roar-multichoice';
const taskId = props.taskId;
const router = useRouter();
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

unsubscribe = authStore.$subscribe(async (mutation, state) => {
  if (state.roarfirekit.restConfig) init();
});

const { isLoading: isLoadingUserData, data: userData } = useQuery({
  queryKey: ['userData', authStore.uid, 'studentData'],
  queryFn: () => fetchDocById('users', authStore.uid, ['studentData']),
  keepPreviousData: true,
  enabled: initialized,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// The following code intercepts the back button and instead forces a refresh.
// We add { once: true } to prevent an infinite loop.
window.addEventListener(
  'popstate',
  () => {
    router.go(0);
  },
  { once: true },
);

onMounted(async () => {
  TaskLauncher = (await import(task)).default;
  if (roarfirekit.value.restConfig) init();
  if (isFirekitInit.value && !isLoadingUserData.value) {
    await startTask(task);
  }
});

watch([isFirekitInit, isLoadingUserData], async ([newFirekitInitValue, newLoadingUserData]) => {
  if (newFirekitInitValue && !newLoadingUserData) await startTask();
});

const { selectedAdmin } = storeToRefs(gameStore);

async function startTask(_task) {
  const appKit = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId);

  const userDob = _get(userData.value, 'studentData.dob');
  const userDateObj = new Date(userDob);

  const userParams = {
    grade: _get(userData.value, 'studentData.grade'),
    birthMonth: userDateObj.getMonth() + 1,
    birthYear: userDateObj.getFullYear(),
    language: props.language,
  };

  const gameParams = { ...appKit._taskInfo.variantParams };

  if (TaskLauncher === undefined) {
    TaskLauncher = (await import(_task)).default;
  }

  const roarApp = new TaskLauncher(appKit, gameParams, userParams, 'jspsych-target');

  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    await authStore.completeAssessment(selectedAdmin.value.id, taskId);

    // Navigate to home, but first set the refresh flag to true.
    gameStore.requireHomeRefresh();
    router.push({ name: 'Home' });
  });
}
</script>
<style>
@import '@bdelab/roar-multichoice/lib/resources/roar-multichoice.css';

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
