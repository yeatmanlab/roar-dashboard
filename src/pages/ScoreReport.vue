<template>
  <ReportSWR v-if="scoreStore.taskId === 'swr'" />
  <div v-else>
    We have not yet implemented a score report for your taskId of {{ scoreStore.taskId }}.
  </div>
</template>

<script setup>
import { useScoreStore } from "@/store/scores";
import ReportSWR from "@/components/reports/ReportSWR.vue";

const scoreStore = useScoreStore();
</script>

<style>

</style>