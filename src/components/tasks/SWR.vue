<template>
  <div id="jspsych-target" class="game-target" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import RoarSWR from '@bdelab/roar-swr';
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

// Send user back to Home if page is reloaded
console.log("HISTORY STATE", history.state)
const entries = performance.getEntriesByType("navigation");
console.log('entries', entries)
entries.forEach((entry) => {
  if (entry.type === "reload") {
    // Detect if our previous reload was on this page, AND if the last naviagtion was a replace.
    if(entry.name === window.location.href && history.state.replaced === true) {
      console.log('found a same entry, leaving game for home')
      router.replace({ name: "Home" })
    }
  }
});

onMounted(async () => {
  console.log('onMounted')
  if(isFirekitInit.value) {
    console.log('launching game from onMounted')
    await startTask();
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  console.log('launching game from watcher')
  await startTask();
})

async function startTask() { 
  console.log('start task')
  const currentAssignment = _head(toRaw(authStore.firekitAssignmentIds))
  const appKit = await authStore.roarfirekit.startAssessment(currentAssignment, "swr")
  console.log('appkit is created')

  const userDob = _get(roarfirekit.value, 'userData.studentData.dob') || _get(firekitUserData.value, 'studentData.dob')
  const userDateObj = new Date(toRaw(userDob).seconds * 1000)
  console.log('user dob is grabbed')

  const userParams = {
    birthMonth: userDateObj.getMonth()+1,
    birthYear: userDateObj.getFullYear(),
  }
  console.log('user params are set up')

  const gameParams = appKit._taskInfo.variantParams
  console.log('about to set up roarApp')
  const roarApp = new RoarSWR(appKit, gameParams, userParams, 'jspsych-target');

  console.log('game started set to true')
  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    console.log('post game actions')
    await authStore.roarfirekit.completeAssessment(currentAssignment, "swr")
    router.replace({ name: "Home" });
  }).catch((e) => {
    console.log('caught', e)
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