<template>
  <div class="text-sm break-before-page">
    <h2 class="text-xl font-bold">{{ $t('scoreReports.taskTabHeader') }}</h2>

    <div v-if="!(studentGrade >= 6)" class="p-1 mb-4 text-center border border-gray-100 border-1">
      <img src="@/assets/support-distribution.png" height="300" />
    </div>

    <p class="mt-0">{{ $t('scoreReports.taskIntro') }}</p>

    <ul class="p-0 pl-3">
      <i18n-t keypath="scoreReports.standardScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ _startCase($t('scoreReports.standardScore')) }}</b
          >: A <b>{{ $t('scoreReports.standardScore') }}</b>
        </template>
      </i18n-t>

      <i18n-t v-if="!(studentGrade >= 6)" keypath="scoreReports.percentileScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ _startCase($t('scoreReports.percentileScore')) }}</b
          >: A <b>{{ $t('scoreReports.percentileScore') }}</b>
        </template>
      </i18n-t>

      <i18n-t keypath="scoreReports.rawScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ _startCase($t('scoreReports.rawScore')) }}</b
          >: A <b>{{ $t('scoreReports.rawScore') }}</b>
        </template>
      </i18n-t>
    </ul>
  </div>

  <div class="pt-4 mt-6 text-sm">
    <h2 class="text-xl font-bold">{{ $t('scoreReports.nextStepsTabHeader') }}</h2>
    <i18n-t keypath="scoreReports.nextSteps" tag="p" class="mt-0">
      <template #link> : {{ getScoreReportNextStepsDocumentPath() }} </template>
    </i18n-t>
  </div>
</template>

<script setup>
import _startCase from 'lodash/startCase';
import { SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH } from '@/constants/scores';

defineProps({
  studentGrade: {
    type: [Number, String],
    default: null,
  },
});

function getScoreReportNextStepsDocumentPath() {
  return `https://roar.education${SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH}`;
  // TODO: Remove the hard-coded return in favor of the dynamic one
  // return `${document.location.origin}${SCORE_REPORT_NEXT_STEPS_DOCUMENT_PATH}`;
}
</script>
