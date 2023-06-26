<template>
  <div id="jspych-target" />
</template>
<script>
import { HotDogApp } from 'roar-repackage'
import { useAuthStore } from "@/store/auth";
const authStore = useAuthStore();
const appKit = await authStore.roarfirekit.startAssessment()
const hda = new HotDogApp()
</script>