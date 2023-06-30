<template>
  <span>Hello PlayApp</span>
  <div id="jspsych-target" />
</template>
<script setup>
import { HotDogApp } from 'roar-repackage';
import { useAuthStore } from "@/store/auth";
import { onMounted } from 'vue';

onMounted(async () => {
  console.log('Hello PlayApp')
  const authStore = useAuthStore();
  const appKit = await authStore.roarfirekit.startAssessment("4GnqGp4KV8dVNmitVQG8", "roar-repackage");
  console.log('reached endpoint', appKit)
  const hda = new HotDogApp(appKit, { registered: true }, 'jspsych-target');
  console.log('hda:', hda)
  hda.run();
})

</script>