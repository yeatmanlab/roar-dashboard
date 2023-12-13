<template>
  <div className="mb-5">
    <Accordion>
      <template #collapseicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <template #expandicon>
        <i class="pi pi-info-circle mr-4" />
      </template>
      <AccordionTab header="ROAR-WORD">
        <div style="text-transform: uppercase" class="text-2xl">Single Word Recognition</div>
        <p class="mt-2">
          ROAR - Word evaluates a student's ability to quickly and automatically recognize individual words. To read
          fluently, students must master fundamental skills of decoding and automaticity. This test measures a student's
          ability to detect real and made-up words, which can then translate to a student's reading levels and need for
          support. The student's score will rangekkk between 100-900 and can be viewed by selecting 'Raw Score' on the
          table
          above.
        </p>
      </AccordionTab>
    </Accordion>
  </div>
  <div class="flex flex-row flex-wrap">
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="swr" graph-type="distByGrade" />
    <DistributionChart
:initialized="initialized" :administration-id="administrationId" :org-type="orgType"
      :org-id="orgId" task-id="swr" graph-type="distBySupport" />
  </div>
  <!-- <div class="task-card">
  </div> -->
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