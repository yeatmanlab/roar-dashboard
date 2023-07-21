<template>
  <div class="col-full text-center">
    <h1>Preparing your game!</h1>
    <AppSpinner />
  </div>
  <div id="jspsych-target" />
</template>
<script setup>
import { HotDogApp } from 'roar-repackage';
import RoarSWR from '@bdelab/roar-swr';
import { useAuthStore } from "@/store/auth";
import { onMounted } from 'vue';
import AppSpinner from '../components/AppSpinner.vue';
import assets from '../assets/tasks/swr.json';

console.log('assets', assets)

onMounted(async () => {
  console.log('Hello PlayApp')
  const authStore = useAuthStore();
  console.log('about to get appKit')
  const appKit = await authStore.roarfirekit.startAssessment("4GnqGp4KV8dVNmitVQG8", "roar-swr")
  console.log('appKit is', appKit)
  // const appKit = await authStore.roarfirekit.startAssessment("4GnqGp4KV8dVNmitVQG8", "roar-repackage");
  // const hda = new HotDogApp(appKit, { registered: true }, 'jspsych-target');
  // hda.run();

  const params = {
      userMode: null, 
      pid: null, 
      studyId: null, 
      classId: null, 
      schoolId: null, 
      taskVariant: null,
      skipInstructions: null,
      audioFeedback: null,
      consent: null,
      numAdaptive: null,
      numNew: null,
      numValidated: null,
      labId: null,
      gameId: null,
      assets: assets,
      bucketURI: 'https://storage.googleapis.com/roar-swr'
  }

  const roarApp = new RoarSWR(appKit, params);
  roarApp.run();

})

</script>