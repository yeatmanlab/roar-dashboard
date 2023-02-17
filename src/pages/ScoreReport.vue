<template>
  <ReportPA v-if="scoreStore.taskId === 'roar-pa'" />
  <ReportSWR v-if="scoreStore.taskId === 'swr'" />
</template>

<script setup>
import { useScoreStore } from "@/store/scores";
import ReportPA from "@/components/ReportPA.vue";
import ReportSWR from "@/components/ReportSWR.vue";

const scoreStore = useScoreStore();
</script>

<style>
</style>