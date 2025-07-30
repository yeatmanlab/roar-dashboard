<template>
  <div class="survey-preview">
    <div class="container">
      <h1>Survey Preview</h1>
      <p>Survey Key: {{ surveyKey }}</p>
      <p>This view will show a live preview of the survey.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  surveyKey: string
}

const props = defineProps<Props>()
</script>

<style scoped>
.survey-preview {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}
</style> 