<template>
  <div id="jspsych-target" class="game-target" translate="no" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import RoarSRE from '@bdelab/roar-sre';
import { onMounted, watch, ref, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useQuery } from '@tanstack/vue-query';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import _get from 'lodash/get';
import { fetchDocById } from '@/helpers/query/utils';

const taskId = 'sre';
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

// Send user back to Home if page is reloaded
const entries = performance.getEntriesByType('navigation');
entries.forEach((entry) => {
  if (entry.type === 'reload') {
    // Detect if our previous reload was on this page, AND if the last naviagtion was a replace.
    if (entry.name === window.location.href && history.state.replaced === true) {
      router.replace({ name: 'Home' });
    }
  }
});

// The following code intercepts the back button and instead forces a refresh.
// We use the ``preventBack`` variable to prevent an infinite loop. I.e., we
// only want to intercept this the first time.
let preventBack = true;
onBeforeRouteLeave((to, from, next) => {
  if (window.event.type === 'popstate' && preventBack) {
    preventBack = false;
    // router.go(router.currentRoute);
    router.go(0);
  } else {
    next();
  }
});

onMounted(async () => {
  if (roarfirekit.value.restConfig) init();
  if (isFirekitInit.value && !isLoadingUserData.value) {
    await startTask();
  }
});

watch([isFirekitInit, isLoadingUserData], async ([newFirekitInitValue, newLoadingUserData]) => {
  if (newFirekitInitValue && !newLoadingUserData) await startTask();
});

let roarApp;

const completed = ref(false);
const { selectedAdmin } = storeToRefs(gameStore);

const selectBestRun = async () => {
  await authStore.roarfirekit.selectBestRun({
    assignmentId: selectedAdmin.value.id,
    taskId,
  });
};

window.addEventListener('beforeunload', selectBestRun, { once: true });
onBeforeUnmount(async () => {
  // if (roarApp && completed.value === false) {
  //   roarApp.abort();
  // }
  selectBestRun();
});

async function startTask() {
  const appKit = await authStore.roarfirekit.startAssessment(selectedAdmin.value.id, taskId);

  const userDob = _get(userData.value, 'studentData.dob');
  const userDateObj = new Date(userDob);

  const userParams = {
    grade: _get(userData.value, 'studentData.grade'),
    birthMonth: userDateObj.getMonth() + 1,
    birthYear: userDateObj.getFullYear(),
  };

  const gameParams = { ...appKit._taskInfo.variantParams, fromDashboard: true };
  roarApp = new RoarSRE(appKit, gameParams, userParams, 'jspsych-target');

  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    await authStore.completeAssessment(selectedAdmin.value.id, taskId);
    completed.value = true;
    // Here we refresh instead of routing home, with the knowledge that a
    // refresh is intercepted above and sent home.
    router.go(0);
  });
}
</script>

<style scoped>
@import '@bdelab/roar-sre/lib/resources/roar-sre.css';

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
