<template>
  <div class="p-3 mb-4 text-sm rounded border border-gray-200 border-solid break-inside-avoid">
    <div class="flex gap-3 justify-between">
      <div class="flex flex-column">
        <h2 class="my-0 text-lg font-semibold">{{ publicName }}</h2>
        <i18n-t :keypath="description.keypath" tag="p">
          <template #firstName>{{ studentFirstName }}</template>
          <template v-for="(_, slotName) in description.slots" #[slotName] :key="slotName">
            <template v-if="slotName === 'taskDescription'">
              {{ description.slots[slotName] }}
            </template>
            <strong v-else>{{ description.slots[slotName] }}</strong>
          </template>
        </i18n-t>
        <i18n-t v-if="!isReliable" keypath="scoreReports.unreliablePrintText" tag="p" class="mt-0">
          <template #reliability>
            <span class="unreliable-text">
              <strong>{{ $t('scoreReports.unreliable').toLowerCase() }}</strong>
            </span>
          </template>
        </i18n-t>
      </div>
      <div class="flex flex-column relative knob-container">
        <p class="text-xs font-thin my-0">{{ scoreLabel }}</p>
        <PvKnob
          readonly
          :value-template="valueTemplate"
          :model-value="score.value"
          :size="130"
          :value-color="score.supportColor"
          :min="score.min"
          :max="score.max"
          :stroke-width="12"
        />
      </div>
    </div>

    <div class="pt-1 text-xs">
      <h3 class="mt-1 text-xs font-semibold uppercase">{{ $t('scoreReports.scoreBreakdown') }}</h3>
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Metric</th>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Score</th>
            <th class="px-2 py-1 font-semibold text-left border border-gray-300 border-solid">Range</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="[key, rawScore, rangeMin, rangeMax] in scoresArray" :key="key">
            <template v-if="!isNaN(rawScore)">
              <td class="px-2 py-1 border border-gray-300 border-solid">{{ key }}</td>

              <td class="px-2 py-1 font-bold border border-gray-300 border-solid">
                {{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}
              </td>

              <td class="px-2 py-1 border border-gray-300 border-solid">{{ rangeMin }}-{{ rangeMax }}</td>
            </template>
          </tr>
        </tbody>
      </table>

      <template v-if="FEATURE_FLAGS.ENABLE_LONGITUDINAL_REPORTS">
        <h3 class="mt-4 text-xs font-semibold uppercase">{{ $t('scoreReports.progressOverTime') }}</h3>
        <LongitudinalChart
          :longitudinal-data="longitudinalData"
          :task-id="taskId"
          :student-grade="studentGrade"
          :current-assignment-id="currentAssignmentId"
        />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { LongitudinalChartPrint as LongitudinalChart } from './LongitudinalChart';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import PvKnob from 'primevue/knob';

const props = defineProps({
  publicName: {
    type: String,
    required: true,
  },
  scoreLabel: {
    type: String,
    required: true,
  },
  score: {
    type: Object,
    required: true,
    validator: (value) => {
      return (
        typeof value === 'object' &&
        value !== null &&
        ('value' in value || 'supportColor' in value || 'min' in value || 'max' in value || 'subscores' in value)
      );
    },
  },
  tags: {
    type: Array,
    required: true,
  },
  valueTemplate: {
    type: String,
    required: false,
    default: undefined,
  },
  scoreToDisplay: {
    type: String,
    required: true,
  },
  studentFirstName: {
    type: String,
    required: true,
  },
  studentGrade: {
    type: String,
    required: true,
  },
  description: {
    type: Object,
    required: true,
  },
  scoresArray: {
    type: Array,
    required: true,
  },
  longitudinalData: {
    type: Array,
    required: false,
    default: () => [],
  },
  taskId: {
    type: String,
    required: true,
  },
  currentAssignmentId: {
    type: String,
    required: true,
  },
});

const isReliable = computed(() => props.tags.find((tag) => tag.label === 'Reliability')?.value === 'Reliable');
</script>

<style scoped>
.knob-container {
  max-height: fit-content;
  position: relative;
}

.knob-container p {
  color: var(--p-knob-text-color);
  position: absolute;
  top: 57%;
  left: 51%;
  transform: translateX(-50%);
}

/* PrimeVue --p-tag-danger-color or --p-red-700 */
.unreliable-text {
  color: #5b0c0f;
}
</style>
