<script setup>
import SurveyRunner from './components/SurveyRunner.vue';

defineProps({
  surveyData: { type: Object, default: () => ({}) },
});
</script>

<template>
  <SurveyRunner :survey-data="surveyData" />
</template>
