<template>
  <div id="jspsych-target" class="game-target" />
  <div v-if="!gameStarted" class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
</template>
<script setup>
import RoarLetter from '@bdelab/roar-letter';
import AppSpinner from '../AppSpinner.vue';
import { toRaw, onMounted, watch, ref, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import _head from 'lodash/head';
import _get from 'lodash/get';

const router = useRouter();
const gameStarted = ref(false);
const authStore = useAuthStore();
const { roarfirekit, firekitUserData, isFirekitInit } = storeToRefs(authStore);

// Send user back to Home if page is reloaded
const entries = performance.getEntriesByType("navigation");
entries.forEach((entry) => {
  if (entry.type === "reload") {
    // Detect if our previous reload was on this page, AND if the last naviagtion was a replace.
    if (entry.name === window.location.href && history.state.replaced === true) {
      router.replace({ name: "Home" })
    }
  }
});

// The following code intercepts the back button and instead forces a refresh.
// We use the ``preventBack`` variable to prevent an infinite loop. I.e., we
// only want to intercept this the first time.
let preventBack = true;
onBeforeRouteLeave((to, from, next) => {
  if (window.event.type === "popstate" && preventBack) {
    preventBack = false;
    // router.go(router.currentRoute);
    router.go(0);
  } else {
    next();
  }
});

onMounted(async () => {
  if (isFirekitInit.value) {
    await startTask();
  }
})

watch(isFirekitInit, async (newValue, oldValue) => {
  await startTask();
})

let roarApp;

const completed = ref(false);
onBeforeUnmount(async () => {
  if (roarApp && completed.value === false) {
    roarApp.abort();
  }
});

async function startTask() {
  const currentAssignment = _head(toRaw(authStore.firekitAssignmentIds))
  const appKit = await authStore.roarfirekit.startAssessment(currentAssignment, "letter")

  const userDob = _get(roarfirekit.value, 'userData.studentData.dob') || _get(firekitUserData.value, 'studentData.dob')
  const userDateObj = new Date(toRaw(userDob).seconds * 1000)

  const userParams = {
    birthMonth: userDateObj.getMonth() + 1,
    birthYear: userDateObj.getFullYear(),
  }

  const gameParams = appKit._taskInfo.variantParams
  roarApp = new RoarLetter(appKit, gameParams, userParams, 'jspsych-target');

  gameStarted.value = true;
  await roarApp.run().then(async () => {
    // Handle any post-game actions.
    completed.value = true;
    await authStore.roarfirekit.completeAssessment(currentAssignment, "letter")
    router.replace({ name: "Home" });
  });
}
</script>
<style scoped> .game-target {
   position: absolute;
   top: 0;
   left: 0;
   width: 100%;
 }

 .game-target:focus {
   outline: none;
 }
</style>