<template>
  <div v-if="gameStarted" id="jspsych-target" class="game-target" />
  <div v-else class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import RoarSRE from '@bdelab/roar-sre';
import AppSpinner from '../AppSpinner.vue';
import { toRaw, onMounted, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _head from 'lodash/head';
import _get from 'lodash/get';

const router = useRouter();
const gameStarted = ref(false);
const authStore = useAuthStore();
const { roarfirekit, firekitUserData, isFirekitInit } = storeToRefs(authStore);

onMounted(async () => {
  if(isFirekitInit.value) {
    await startTask();
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  await startTask();
})

async function startTask() { 
  const currentAssignment = _head(toRaw(authStore.firekitAssignmentIds))
  const appKit = await authStore.roarfirekit.startAssessment(currentAssignment, "sre")
  console.log('appKit is defined as', appKit)

  const userParams = {
    grade: _get(roarfirekit.value, 'userData.studentData.grade') || _get(firekitUserData.value, 'studentData.grade')
  }
  const gameParams = appKit._taskInfo.variantParams
  const roarApp = new RoarSRE(appKit, gameParams, userParams, 'jspsych-target');

  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    await authStore.roarfirekit.completeAssessment(currentAssignment, "sre")
    router.replace({ name: "Home" });
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