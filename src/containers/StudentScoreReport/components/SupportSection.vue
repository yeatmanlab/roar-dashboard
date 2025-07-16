<template>
  <div id="support-graphic">
    <PvAccordion v-model:value="visiblePanels" class="my-2 w-full" multiple>
      <PvAccordionPanel :value="SUPPORT_PANELS.TASK">
        <PvAccordionHeader>{{ $t('scoreReports.taskTabHeader') }}</PvAccordionHeader>
        <PvAccordionContent>
          <div
            v-if="!(studentGrade >= 6)"
            class="flex p-3 mb-4 border border-gray-100 border-1 flex-column align-items-center"
          >
            <img src="../../../assets/support-distribution.png" width="650" />
          </div>

          <p class="mt-0">{{ $t('scoreReports.taskIntro') }}</p>
          <ul>
            <i18n-t keypath="scoreReports.standardScoreDescription" tag="li">
              <template #taskTitle>
                <b>{{ _startCase($t('scoreReports.standardScore')) }}</b
                >: A <b>{{ $t('scoreReports.standardScore') }}</b>
              </template>
            </i18n-t>

            <i18n-t v-if="!(studentGrade >= 6)" keypath="scoreReports.percentileScoreDescription" tag="li">
              <template #taskTitle>
                <b>{{ _startCase($t('scoreReports.percentileScore')) }}</b
                >: A <b>{{ $t('scoreReports.percentileScore') }}</b>
              </template>
            </i18n-t>

            <i18n-t keypath="scoreReports.rawScoreDescription" tag="li">
              <template #taskTitle>
                <b>{{ _startCase($t('scoreReports.rawScore')) }}</b
                >: A <b>{{ $t('scoreReports.rawScore') }}</b>
              </template>
            </i18n-t>
          </ul>

          <div v-if="studentGrade >= 6">
            <i18n-t keypath="scoreReports.roarDescription" tag="p">
              <template #roar>
                <b>ROAR</b>
              </template>
            </i18n-t>
            <i18n-t keypath="scoreReports.extraSupportDescription" tag="p">
              <template #supportCategory>
                <span class="font-bold text-pink-600">{{ $t('scoreReports.extraSupport') }}</span>
              </template>
            </i18n-t>
          </div>
        </PvAccordionContent>
      </PvAccordionPanel>

      <PvAccordionPanel :value="SUPPORT_PANELS.NEXT_STEPS">
        <PvAccordionHeader>{{ $t('scoreReports.nextStepsTabHeader') }}</PvAccordionHeader>
        <PvAccordionContent>
          <i18n-t keypath="scoreReports.nextSteps" tag="p" class="mt-0">
            <template #link>
              <a href="/docs/roar-next-steps.pdf" class="text-gray-700 hover:text-red-700" target="_blank">click here</a
              >.
            </template>
          </i18n-t>
        </PvAccordionContent>
      </PvAccordionPanel>
    </PvAccordion>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import _startCase from 'lodash/startCase';
import PvAccordion from 'primevue/accordion';
import PvAccordionPanel from 'primevue/accordionpanel';
import PvAccordionHeader from 'primevue/accordionheader';
import PvAccordionContent from 'primevue/accordioncontent';

const SUPPORT_PANELS = Object.freeze({
  TASK: '1',
  NEXT_STEPS: '2',
});

const props = defineProps({
  expanded: {
    type: Boolean,
    default: false,
  },
  studentGrade: {
    type: [Number, String],
    default: null,
  },
});

const visiblePanels = ref(props.expanded ? [SUPPORT_PANELS.TASK, SUPPORT_PANELS.NEXT_STEPS] : []);

watch(
  () => props.expanded,
  (newValue) => {
    visiblePanels.value = newValue ? [SUPPORT_PANELS.TASK, SUPPORT_PANELS.NEXT_STEPS] : [];
  },
  { immediate: true },
);
</script>
