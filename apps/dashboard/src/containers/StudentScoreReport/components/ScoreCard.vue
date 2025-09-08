<template>
  <article
    class="flex gap-4 pt-4 bg-white border-2 border border-gray-100 flex-column align-items-center justify-content-center"
  >
    <div class="flex gap-3 px-4 flex-column align-items-center justify-content-center">
      <div class="flex gap-1 text-center flex-column">
        <h2 class="m-0 text-lg font-semibold">{{ publicName }}</h2>
        <div class="text-sm font-thin text-gray-400">{{ scoreLabel }}</div>
      </div>

      <div class="flex gap-2">
        <div
          v-for="tag in tags"
          :key="tag.value"
          class="flex flex-row w-full align-items-center justify-content-center"
        >
          <PvTag
            v-tooltip.top="tag.tooltip"
            :icon="tag.icon"
            :value="tag.value"
            :severity="tag.severity"
            class="text-xs"
          />
        </div>
      </div>
    </div>

    <div class="flex gap-2 px-4 flex-column align-items-center justify-content-center">
      <PvKnob
        readonly
        :value-template="valueTemplate"
        :model-value="score.value"
        :size="180"
        :value-color="score.supportColor"
        :min="score.min"
        :max="score.max"
      />

      <i18n-t :keypath="description.keypath" tag="p" class="mb-0">
        <template #firstName>{{ studentFirstName }}</template>
        <template v-for="(_, slotName) in description.slots" #[slotName] :key="slotName">
          <template v-if="slotName === 'taskDescription'">
            {{ description.slots[slotName] }}
          </template>
          <strong v-else>{{ description.slots[slotName] }}</strong>
        </template>
      </i18n-t>
    </div>

    <template v-if="scoresArray?.length || longitudinalData?.length > 0">
      <PvAccordion v-model:value="visiblePanels" class="px-4 w-full border-t border-gray-100">
        <PvAccordionPanel
          class="bg-gray-50"
          :pt="{ root: { class: 'border-0' } }"
          :value="ACCORDION_PANELS.SCORE_BREAKDOWN"
        >
          <PvAccordionHeader :pt="{ root: { class: 'px-0' } }">
            {{ $t('scoreReports.scoreBreakdown') }}
          </PvAccordionHeader>
          <PvAccordionContent :pt="{ content: { class: 'px-0' } }">
            <div v-for="[key, rawScore, rangeMin, rangeMax] in scoresArray" :key="key">
              <div v-if="!isNaN(rawScore)" class="flex justify-content-between">
                <div class="mr-2">
                  <b>{{ key }}</b>
                  <span v-if="rangeMax" class="text-500"> ({{ rangeMin }}-{{ rangeMax }}):</span>
                  <span v-else>:</span>
                </div>

                <div class="ml-2">
                  <b>{{ isNaN(rawScore) ? rawScore : Math.round(rawScore) }}</b>
                </div>
              </div>
            </div>
          </PvAccordionContent>
        </PvAccordionPanel>

        <PvAccordionPanel
          v-if="longitudinalData?.length > 0"
          class="bg-gray-50"
          :pt="{ root: { class: 'border-0' } }"
          :value="ACCORDION_PANELS.LONGITUDINAL"
        >
          <PvAccordionHeader :pt="{ root: { class: 'px-0' } }">
            {{ $t('scoreReports.progressOverTime') }}
          </PvAccordionHeader>
          <PvAccordionContent :pt="{ content: { class: 'px-0' } }">
            <LongitudinalChart :longitudinal-data="longitudinalData" />
            <div class="historical-scores mt-4">
              <div v-for="historicalScore in longitudinalData" :key="historicalScore.assignmentId" class="historical-score-item p-3 surface-100 border-round mb-2">
                <div class="flex justify-content-between align-items-center mb-2">
                  <span class="date font-semibold">{{ formatDate(historicalScore.date) }}</span>
                </div>
                <div class="score-types grid">
                  <div v-for="(value, type) in historicalScore.scores?.composite" :key="type" class="score-type-item col-6 flex justify-content-between align-items-center p-2">
                    <span class="score-label text-500">{{ formatScoreType(type) }}:</span>
                    <span class="score-value font-semibold">{{ Math.round(value.value) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </PvAccordionContent>
        </PvAccordionPanel>
      </PvAccordion>
    </template>
  </article>
</template>

<script setup>
import { ref, watch } from 'vue';
import _startCase from 'lodash/startCase';
import PvKnob from 'primevue/knob';
import PvTag from 'primevue/tag';
import PvAccordion from 'primevue/accordion';
import PvAccordionPanel from 'primevue/accordionpanel';
import PvAccordionHeader from 'primevue/accordionheader';
import PvAccordionContent from 'primevue/accordioncontent';
import LongitudinalChart from '@/components/reports/LongitudinalChart.vue';

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
  description: {
    type: Object,
    required: true,
  },
  scoresArray: {
    type: Array,
    required: true,
  },
  expanded: {
    type: Boolean,
    required: false,
  },
  longitudinalData: {
    type: Array,
    required: false,
    default: () => [],
  },
});

const ACCORDION_PANELS = Object.freeze({
  SCORE_BREAKDOWN: 'scoreBreakdown',
  HISTORICAL_SCORES: 'historicalScores',
  LONGITUDINAL: 'longitudinal',
});

const visiblePanels = ref([]);

const formatDate = (date) => {
  return new Date(date).toLocaleDateString(undefined, { 
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatScoreType = (type) => {
  return _startCase(type.replace(/([A-Z])/g, ' $1').toLowerCase());
};

watch(
  () => props.expanded,
  (newValue) => {
    visiblePanels.value = newValue ? [ACCORDION_PANELS.SCORE_BREAKDOWN] : [];
  },
  { immediate: true },
);
</script>
