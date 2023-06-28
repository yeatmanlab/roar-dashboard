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
  // const authStore = useAuthStore();
  // const appKit = await authStore.roarfirekit.startAssessment("4GnqGp4KV8dVNmitVQG8", "roar-repackage");
  // const hda = new HotDogApp(appKit, { registered: true });
  // hda.run();
})

</script>