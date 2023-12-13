<template>
  <Accordion>
    <template #collapseicon>
      <i class="pi pi-info-circle mr-4" />
    </template>
    <template #expandicon>
      <i class="pi pi-info-circle mr-4" />
    </template>
    <AccordionTab header="ROAR-LETTER">
      <div style="text-transform: uppercase" class="text-2xl">Single Word Recognition</div>
      <p class="mt-2">
        ROAR-Letter assesses a student’s knowledge of letter names and letter sounds. Knowing letter names supports the
        learning of letter sounds, and knowing letter sounds supports the learning of letter names. Initial knowledge of
        letter names and letter sounds on entry to kindergarten has been shown to predict success in learning to read.
        Learning the connection between letters and the sounds they represent is fundamental for learning to decode and
        spell words. This assessment provides educators with valuable insights to customize instruction and address any
        gaps in these foundational skills.
      </p>
    </AccordionTab>
  </Accordion>
  <div className="flex flex-row flex-wrap">
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="letter" graph-type="distByGrade" />
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="letter" graph-type="distBySupport" />
  </div>
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
