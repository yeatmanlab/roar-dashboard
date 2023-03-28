<template>
  <ReportSWR v-if="scoreStore.taskId === 'swr'" />
  <ReportPA v-else-if="scoreStore.taskId === 'roar-pa'" />
  <ReportSRE v-else-if="scoreStore.taskId === 'sre'" />
  <div v-else>
    We have not yet implemented a score report for your taskId of {{ scoreStore.taskId }}.
  </div>
</template>

<script setup>
import { useScoreStore } from "@/store/scores";
import ReportSWR from "@/components/reports/ReportSWR.vue";
import ReportPA from "@/components/reports/ReportPA.vue";
import ReportSRE from "@/components/reports/ReportSRE.vue";


const scoreStore = useScoreStore();
</script>

<style>

</style>