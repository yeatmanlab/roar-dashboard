<template>
  <div class="text-sm">
    <div class="text-left">
      <h1 class="p-0 m-0 text-5xl">
        <span class="block mb-1 text-sm text-gray-600 uppercase">
          {{ $t('scoreReports.pageTitle') }}
        </span>
        <span class="hidden">: </span>
        <span>{{ studentFirstName }} {{ studentLastName }}</span>
      </h1>
    </div>

    <dl v-if="studentGrade || className || administrationName" class="flex gap-6 justify-between py-2 w-full">
      <div class="flex gap-6">
        <div v-if="administrationName" class="inline-block">
          <dt class="inline font-semibold">{{ $t('scoreReports.administration') }}:</dt>
          <dd class="inline ml-2">{{ administrationName }}</dd>
        </div>
        <div v-if="className" class="inline-block">
          <dt class="inline font-semibold">{{ $t('scoreReports.class') }}:</dt>
          <dd class="inline ml-2">{{ className }}</dd>
        </div>
      </div>

      <div v-if="studentGrade" class="inline-block">
        <dt class="inline font-semibold">{{ $t('scoreReports.grade') }}:</dt>
        <dd class="inline ml-2">{{ getGradeWithSuffix(studentGrade) }}</dd>
      </div>
    </dl>
  </div>
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
