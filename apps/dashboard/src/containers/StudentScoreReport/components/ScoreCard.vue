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
            <!-- Regular scores -->
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

            <!-- Phonics subscores -->
            <template v-if="taskId === 'phonics' && score?.subscores && Object.keys(score.subscores).length > 0">
              <div class="mt-4 mb-2 font-semibold">{{ $t('scoreReports.phonicsSubscores') }}:</div>
              <div
                v-for="[key, value] in Object.entries(score.subscores || {})"
                :key="key"
                class="flex justify-content-between mb-1 px-2"
              >
                <div class="mr-2">
                  <span>{{ formatPhonicsKey(key) }}</span>
                </div>
                <div class="ml-2">
                  <b>{{ value }}</b>
                </div>
              </div>
            </template>
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
            <LongitudinalChart :longitudinal-data="longitudinalData" :task-id="taskId" :grade="grade" />
          </PvAccordionContent>
        </PvAccordionPanel>
      </PvAccordion>
    </template>
  </article>
</template>

<script setup>
import { ref, watch } from 'vue';
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
  taskId: {
    type: String,
    required: true,
  },
  grade: {
    type: Number,
    required: false,
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
    day: 'numeric',
  });
};

const formatScoreType = (type) => {
  return _startCase(type);
};

const formatPhonicsKey = (key) => {
  const keyMap = {
    cvc: 'CVC Words',
    digraph: 'Digraphs',
    initial_blend: 'Initial Blends',
    final_blend: 'Final Blends',
    r_controlled: 'R-Controlled',
    r_cluster: 'R-Clusters',
    silent_e: 'Silent E',
    vowel_team: 'Vowel Teams',
  };
  return keyMap[key] || _startCase(key);
};

watch(
  () => props.expanded,
  (newValue) => {
    visiblePanels.value = newValue ? [ACCORDION_PANELS.SCORE_BREAKDOWN] : [];
  },
  { immediate: true },
);
</script>
