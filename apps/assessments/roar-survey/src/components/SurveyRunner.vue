<template>
  <div v-show="progressStatus === 'survey'" class="survey-wrapper">
    <SurveyComponent v-if="surveyModel" :model="surveyModel" @complete="onComplete" />
  </div>
  <template v-if="progressStatus === 'uploading' || progressStatus === 'completed'">
    <slot name="uploading">
      <p class="status-message">Thank you for completing the survey</p>
      <template v-if="progressStatus === 'uploading'">
        <p class="status-submessage">Uploading your answers...</p>
        <p class="status-submessage">Please don't close or refresh the page.</p>
        <ProgressSpinner />
      </template>
    </slot>
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Model } from 'survey-core';
import { SurveyComponent } from 'survey-vue3-ui';
import { startRun, writeTrial, finishRun, initFirekitCompat } from '@roar-platform/assessment-sdk/compat/firekit';
import { AssessmentStage } from '@roar-platform/assessment-schema';
import ProgressSpinner from './ProgressSpinner.vue';
import '../styles/survey-runner.css';
import 'survey-core/survey-core.min.css';
import themeJson from '../themes/survey_theme_new.json';
import { insertResponsiveClasses, hideRequiredIndicator, openFullscreen } from '../utils/surveyEventHandlers';

const props = defineProps({
  surveyData: { type: Object, required: true },
  /**
   * Host-supplied SDK wiring, `{ ctx, taskInfo }`. When present this component initializes the
   * SDK itself; when absent the host must have called `initFirekitCompat` already — the
   * pre-#2016 contract, still used by the dashboard until it migrates.
   *
   * Unlike the class-based assessments, no variant parameters are resolved here: the survey's
   * variant carries a GCS filename the host fetches content with, using a bucket URL that
   * differs per host, so resolution stays with the host.
   */
  sdkContext: { type: Object, default: null },
});

const emit = defineEmits(['completeSurvey']);

const progressStatus = ref('survey');
const surveyModel = ref(null);

const onComplete = async (sender) => {
  progressStatus.value = 'uploading';
  const responses = sender.data;

  await Promise.all(
    Object.entries(responses).map(([questionName, answer], index) =>
      writeTrial({
        questionName,
        response: answer,
        itemIndex: index,
        // Surveys have no practice phase — every response is a test-stage trial.
        assessment_stage: AssessmentStage.TEST,
        correct: 1,
      }),
    ),
  );

  await finishRun();
  emit('completeSurvey');
  progressStatus.value = 'completed';
};

const createModel = ({ survey, theme = themeJson, eventHandlers = {} }) => {
  const model = new Model(survey);
  model.applyTheme(theme);
  for (const [eventName, handlers] of Object.entries(eventHandlers)) {
    handlers.forEach((handler) => model[eventName].add(handler));
  }
  return model;
};

onMounted(async () => {
  // Earliest lifecycle hook, so nothing here can have touched the SDK before this point.
  if (props.sdkContext) {
    initFirekitCompat(props.sdkContext.ctx, props.sdkContext.taskInfo);
  }

  await startRun();

  if (props.surveyData) {
    surveyModel.value = createModel({
      survey: props.surveyData,
      eventHandlers: {
        onAfterRenderPage: [insertResponsiveClasses, hideRequiredIndicator, openFullscreen],
      },
    });
  }
});
</script>
