<template>
  <div v-if="gameStarted" id="jspsych-target" class="game-target" />
  <div v-else class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import RoarSWR from '@bdelab/roar-swr';
import RoarPA from '@bdelab/roar-pa';
import RoarSRE from '@bdelab/roar-sre';
import { useAuthStore } from '@/store/auth';
import { toRaw, onMounted, ref, watch } from 'vue';
import AppSpinner from '../components/AppSpinner.vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import _head from 'lodash/head';

const router = useRouter();
const currentGameId = router.currentRoute.value.params.gameId;
const gameStarted = ref(false);
const authStore = useAuthStore();
const { isFirekitInit } = storeToRefs(authStore);

onMounted(async () => {
  if (isFirekitInit.value) {
    await startTask();
  }
});

watch(isFirekitInit, async () => {
  await startTask();
});

async function startTask() {
  const currentAssignment = _head(toRaw(authStore.firekitAssignmentIds));
  const appKit = await authStore.roarfirekit.startAssessment(currentAssignment, currentGameId);

  const userParams = {
    pid: appKit._userInfo.assessmentPid,
    labId: 'yeatmanlab',
  };

  const gameParams = appKit._taskInfo.variantParams;

  let roarApp = null;
  switch (currentGameId) {
    case 'swr':
      roarApp = new RoarSWR(appKit, gameParams, userParams, 'jspsych-target');
      break;
    case 'pa':
      roarApp = new RoarPA(appKit, gameParams, userParams, 'jspsych-target');
      break;
    case 'sre':
      roarApp = new RoarSRE(appKit, gameParams, userParams, 'jspsych-target');
      break;
  }

  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    await authStore.roarfirekit.completeAssessment(currentAssignment, currentGameId);
    router.replace({ name: 'Home' });
  });
}
</script>
<style scoped>
.game-target {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.game-target:focus {
  outline: none;
}
</style>
