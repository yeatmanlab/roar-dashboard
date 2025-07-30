<template>
  <section
    id="individual-report-header"
    class="flex my-2 flex-column md:flex-row md:align-items-center md:justify-between"
    data-cy="report__header"
  >
    <div class="my-3 text-left">
      <h1 class="mb-1 text-sm text-gray-400 uppercase">
        {{ $t('scoreReports.pageTitle') }}
      </h1>
      <h2 class="p-0 m-0 text-5xl">{{ studentFirstName }} {{ studentLastName }}</h2>
    </div>

    <div class="px-4 py-2 bg-gray-100 rounded">
      <dl v-if="studentGrade" class="flex gap-2 flex-column">
        <div class="inline-flex">
          <dt class="font-semibold">{{ $t('scoreReports.grade') }}:</dt>
          <dd class="ml-2">{{ getGradeWithSuffix(studentGrade) }}</dd>
        </div>
        <div v-if="className" class="inline-flex">
          <dt class="font-semibold">{{ $t('scoreReports.class') }}:</dt>
          <dd class="ml-2">{{ className }}</dd>
        </div>
        <div v-if="administrationName" class="inline-flex">
          <dt class="font-semibold">{{ $t('scoreReports.administration') }}:</dt>
          <dd class="ml-2">{{ administrationName }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup>
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
  exportLoading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggleExpand', 'exportPdf']);
</script>
