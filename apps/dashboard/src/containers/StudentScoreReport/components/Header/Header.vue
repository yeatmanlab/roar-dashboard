<template>
  <section data-cy="report__header" aria-labelledby="page-title">
    <div class="flex flex-column lg:flex-row lg:align-items-center lg:justify-between">
      <h1 id="page-title" class="p-0 m-0 text-5xl">
        <span class="block mb-1 text-sm font-medium text-gray-500 uppercase">
          {{ $t('scoreReports.pageTitle') }}
        </span>
        <span>{{ studentFirstName }} {{ studentLastName }}</span>
      </h1>

      <div class="flex gap-2">
        <PvButton
          severity="secondary"
          variant="outlined"
          :label="!expanded ? $t('scoreReports.expandSections') : $t('scoreReports.collapseSections')"
          :icon="
            !expanded ? 'pi pi-chevron-down ml-2 transition-all' : 'pi pi-chevron-down ml-2 transition-all rotate-180'
          "
          icon-pos="right"
          data-html2canvas-ignore="true"
          data-cy="report__expand-btn"
          @click="$emit('toggleExpand')"
        />

        <PvButton
          severity="secondary"
          variant="outlined"
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

    <dl v-if="studentGrade || className || administrationName" class="flex flex-wrap gap-4 mt-4 w-full text-gray-600">
      <div v-if="studentGrade" class="inline-flex p-1 px-2 bg-gray-200 rounded">
        <dt class="font-medium">{{ $t('scoreReports.grade') }}:</dt>
        <dd class="ml-1">{{ getGradeWithSuffix(studentGrade) }}</dd>
      </div>
      <div v-if="className" class="inline-flex p-1 px-2 bg-gray-200 rounded">
        <dt class="font-medium">{{ $t('scoreReports.class') }}:</dt>
        <dd class="ml-1">{{ className }}</dd>
      </div>
      <div v-if="administrationName" class="inline-flex p-1 px-2 bg-gray-200 rounded">
        <dt class="font-medium">{{ $t('scoreReports.administration') }}:</dt>
        <dd class="ml-1">{{ administrationName }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import PvButton from 'primevue/button';
import { getGradeWithSuffix } from '@/helpers/reports.js';

defineProps({
  studentFirstName: {
    type: String,
    required: true,
  },
  studentLastName: {
    type: String,
    default: '',
  },
  studentGrade: {
    type: [String, Number],
    default: null,
  },
  className: {
    type: String,
    default: '',
  },
  administrationName: {
    type: String,
    default: '',
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  exportPdf: {
    type: Function,
    default: () => {},
  },
  exportLoading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggleExpand', 'exportPdf']);
</script>
