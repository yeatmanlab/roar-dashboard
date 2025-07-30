<template>
  <div class="survey-detail">
    <div class="container">
      <h1>Survey Details</h1>
      <p>Survey Key: {{ surveyKey }}</p>
      <p>This view will show detailed information about a specific survey.</p>
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
.survey-detail {
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}
</style> 