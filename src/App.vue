<script setup>
import SurveyRunner from './components/SurveyRunner.vue'
import { firekit } from './main'

defineProps({
  surveyData: {
    type: Object,
    default: () => ({})
  }
})
</script>

<template>
  <SurveyRunner :appkit="firekit" standalone :surveyData="surveyData"/>
</template>


<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
