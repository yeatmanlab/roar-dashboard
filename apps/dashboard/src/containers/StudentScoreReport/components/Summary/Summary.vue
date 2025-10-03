<template>
  <section>
    <div class="flex p-4 rounded bg-primary align-items-center justify-content-between" data-html2canvas-ignore>
      <div class="text-xl font-bold text-white">
        {{ $t('scoreReports.welcome') }}
      </div>

      <div class="flex gap-2">
        <PvButton
          outlined
          class="p-3 text-white border-white bg-primary border-1 border-round h-3rem hover:bg-red-900"
          :label="!expanded ? $t('scoreReports.expandSections') : $t('scoreReports.collapseSections')"
          :icon="!expanded ? 'pi pi-plus ml-2' : 'pi pi-minus ml-2'"
          icon-pos="right"
          data-html2canvas-ignore="true"
          data-cy="report__expand-btn"
          @click="$emit('toggleExpand')"
        />
        <PvButton
          outlined
          class="p-3 text-white border-white bg-primary border-1 border-round h-3rem hover:bg-red-900"
          :label="$t('scoreReports.exportPDF')"
          :icon="exportLoading ? 'pi pi-spin pi-spinner ml-2' : 'pi pi-download ml-2'"
          :disabled="exportLoading"
          icon-pos="right"
          data-html2canvas-ignore="true"
          data-cy="report__pdf-export-btn"
          @click="$emit('exportPdf')"
        />
      </div>
    </div>

    <div id="individual-report-banner" class="py-4 mt-2 lg:pr-8">
      {{ $t('scoreReports.roarSummary') }}

      <i18n-t keypath="scoreReports.completedTasks" tag="div" class="mt-2">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
      <ul class="p-0 list-none columns-2">
        <li v-for="task in tasks" :key="task" class="pb-1 before:pi before:pi-check">
          <strong>{{ task }}</strong>
        </li>
      </ul>
      <i18n-t keypath="scoreReports.summary" tag="div">
        <template #firstName>
          {{ studentFirstName }}
        </template>
      </i18n-t>
    </div>
  </section>
</template>

<script setup>
import PvButton from 'primevue/button';

defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  exportLoading: {
    type: Boolean,
    default: false,
  },
  tasks: {
    type: String,
    required: true,
  },
});

defineEmits(['toggleExpand', 'exportPdf']);
</script>

<style scoped>
/* ul {
  list-style: none;
  padding: 0;
  margin: 0;
} */
ul li {
  position: relative;
}
ul li::before {
  content: '\e909'; /* Unicode for pi-check */
  font-family: 'PrimeIcons';
  font-size: 0.75rem;
  color: #16a34a; /* Tailwind green-600 */
  margin-right: 0.5rem;
}
</style>
