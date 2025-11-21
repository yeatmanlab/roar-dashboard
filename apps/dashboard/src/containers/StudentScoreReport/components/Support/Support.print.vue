<template>
  <div class="text-xs">
    <h2 class="text-lg font-bold">{{ $t('scoreReports.taskTabHeader') }}</h2>

    <div v-if="isDistributionChartEnabled" class="p-1 mt-1 mb-2 text-center border border-gray-100 border-1">
      <img :src="distributionChartPath" height="300" />
    </div>

    <p>{{ $t('scoreReports.taskIntro') }}</p>

    <ul class="p-0 pl-3">
      <i18n-t keypath="scoreReports.standardScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ $t('scoreReports.standardScore') }}</b
          >: A <b>{{ $t('scoreReports.standardScore') }}</b>
        </template>
      </i18n-t>

      <i18n-t v-if="!(studentGrade >= 6)" keypath="scoreReports.percentileScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ $t('scoreReports.percentileScore') }}</b
          >: A <b>{{ $t('scoreReports.percentileScore') }}</b>
        </template>
      </i18n-t>

      <i18n-t keypath="scoreReports.rawScoreDescription" tag="li" class="mb-2">
        <template #taskTitle>
          <b>{{ $t('scoreReports.rawScore') }}</b
          >: A <b>{{ $t('scoreReports.rawScore') }}</b>
        </template>
      </i18n-t>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  studentGrade: {
    type: [Number, String],
    default: null,
  },
  distributionChartPath: {
    type: String,
    required: true,
  },
  isDistributionChartEnabled: {
    type: Boolean,
    default: true,
  },
});
</script>
