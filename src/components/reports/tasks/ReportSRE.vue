<template>
  <div className="mb-5">
    <Accordion>
      <template #collapseicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <template #expandicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <AccordionTab header="ROAR-SENTENCE">
        <div style="text-transform: uppercase" class="text-2xl">Sentence Reading Efficiency</div>
        <p class="mt-2">
          ROAR - Sentence examines silent reading fluency and comprehension for individual sentences. To become fluent
          readers, students need to decode words accurately and read sentences smoothly. Poor fluency can make it harder
          for
          students to understand what they're reading. Students who don't receive support for their basic reading skills
          may
          find it challenging to improve their overall reading ability. This assessment is helpful for identifying
          students
          who may struggle with reading comprehension due to difficulties with decoding words accurately or reading slowly
          and with effort. The student's score will range between 0-130 and can be viewed by selecting 'Raw Score' on the
          table above.
        </p>
      </AccordionTab>
    </Accordion>
  </div>
  <div class="flex flex-row flex-wrap">
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="sre" graph-type="distByGrade" />
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="sre" graph-type="distBySupport" />
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
}</style>
