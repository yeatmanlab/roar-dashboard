<template>
  <div className="mb-5">
    <Accordion>
      <template #collapseicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <template #expandicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <AccordionTab header="ROAR-PHONEME">
        <div style="text-transform: uppercase" class="text-2xl">Phonological Awareness</div>
        <p class="mt-2">
          ROAR - Phoneme assesses a student's mastery of phonological awareness through elision and sound matching tasks.
          Research indicates that phonological awareness, as a foundational pre-reading skill, is crucial for achieving
          reading fluency. Without support for their foundational reading abilities, students may struggle to catch up in
          overall reading proficiency. The student's score will range between 0-57 and can be viewed by selecting 'Raw
          Score' on the table above.
        </p>
      </AccordionTab>
    </Accordion>
  </div>
  <div class="flex flex-row flex-wrap">
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="pa" graph-type="distByGrade" />
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="pa" graph-type="distBySupport" />
  </div>
</template>
<script setup>
import DistributionChart from '../DistributionChart.vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
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
