<template>
  <span>Hello PlayApp</span>
  <div id="jspsych-target" />
</template>
<script setup>
import { HotDogApp } from 'roar-repackage';
import { useAuthStore } from "@/store/auth";
import { onMounted } from 'vue';

onMounted(async () => {
const authStore = useAuthStore();
const appKit = await authStore.roarfirekit.startAssessment();
// const hda = new HotDogApp(appKit, {});
  hda.run();
})

</script>