<script setup>
import SurveyRunner from './components/SurveyRunner.vue';

// All three are pass-through to SurveyRunner, which owns SDK initialization, variant
// resolution, and fetching its own content. See its prop docs.
defineProps({
  sdkContext: { type: Object, default: null },
  language: { type: String, default: 'en' },
  surveyFile: { type: String, default: null },
});
</script>

<template>
  <SurveyRunner :sdk-context="sdkContext" :language="language" :survey-file="surveyFile" />
</template>
