<template>
  <div class="task-card">
    <div class="task-title">ROAR-PHONEME</div>
    <span style="text-transform: uppercase">Phonological Awareness</span>
    <p class="task-description">
      ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks.
      Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving
      reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in
      overall reading proficiency. The student's score will range between 0-57 and can be viewed by selecting 'Raw
      Score' on the table above.
    </p>
  </div>
  <DistributionChart
    :initialized="initialized"
    :administration-id="administrationId"
    :org-type="orgType"
    :org-id="orgId"
    task-id="pa"
    graph-type="distByGrade"
  />
</template>
<script setup>
import DistributionChart from '../DistributionChart.vue';
// eslint-disable-next-line no-unused-vars
const props = defineProps({
  initialized: {
    type: Boolean,
    required: true,
  },
  administrationId: {
    type: String,
    required: true,
  },
  orgType: {
    type: String,
    required: true,
  },
  orgId: {
    type: String,
    required: true,
  },
});
</script>
<style>
.task-card {
  background: #f6f6fe;
  padding: 2rem;
  text-align: center;
  margin-bottom: 1rem;
}

.task-title {
  font-size: 3.5rem;
  /* font-weight: bold; */
}

.task-description {
  font-size: 1.25rem;
  text-align: left;
}
</style>
