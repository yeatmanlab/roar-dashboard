<template>
  <div class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
  <div id="jspsych-target" />
</template>
<script setup>
import { HotDogApp } from 'roar-repackage';
import RoarSWR from '@bdelab/roar-swr'; // TODO: make this a dynamic import
import RoarPA from '@bdelab/roar-pa';
import RoarSRE from '@bdelab/roar-sre';
import { useAuthStore } from "@/store/auth";
import { onMounted, toRaw } from 'vue';
import AppSpinner from '../components/AppSpinner.vue';
import assets from '../assets/tasks/swr.json';
import { useRouter } from 'vue-router';

const router = useRouter();
const currentGameId = (router.currentRoute).value.params.gameId;


// TODO: have this in a roarfirekit ready watcher
onMounted(async () => {
  // console.log('importing', `@bdelab/roar-${currentGameId}`)
  // const RoarAppImport = await import(`@bdelab/roar-${currentGameId}`).then((roarApp) => {
  //   console.log('inside import statement:', roarApp)
  // });
  console.log('Hello PlayApp')
  const authStore = useAuthStore();
  console.log('about to get appKit')
  console.log('assessment ID', authStore.assignedAssignments)
  // TODO: get assessment ID dynamically
  const appKit = await authStore.roarfirekit.startAssessment("4GnqGp4KV8dVNmitVQG8", "sre")
  console.log('appKit is', appKit)

  console.log('appKit assessmentPid', appKit._userInfo.assessmentPid)
  console.log('variant params', appKit._taskInfo.variantParams)

  const userParams = {
    pid: appKit._userInfo.assessmentPid,
    labId: "yeatmanlab", 
  }

  const gameParams = appKit._taskInfo.variantParams

  // TODO: shouldn't have to change after dynamic import
  const roarApp = new RoarSRE(appKit, gameParams, userParams);
  await roarApp.run();
})

</script>