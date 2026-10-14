<script setup>
import SurveyRunner from './components/SurveyRunner.vue';

defineProps({
  surveyData: { type: Object, default: () => ({}) },
  /** Forwarded to SurveyRunner — see its `sdkContext` prop. */
  sdkContext: { type: Object, default: null },
});
</script>

<template>
  <SurveyRunner :survey-data="surveyData" :sdk-context="sdkContext" />
</template>
