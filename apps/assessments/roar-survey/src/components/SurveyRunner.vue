<template>
  <div v-show="progressStatus === 'survey'" class="survey-wrapper">
    <SurveyComponent v-if="surveyModel" :model="surveyModel" @complete="onComplete" />
  </div>
  <template v-if="progressStatus === 'uploading' || progressStatus === 'completed'"> 
    <slot name="uploading">
      <p class="status-message"> Thank you for completing the survey</p>
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
import ProgressSpinner from './ProgressSpinner.vue'
import '../styles/survey-runner.css'
import 'survey-core/survey-core.min.css';
import themeJson from '../themes/survey_theme_new.json';
import { getBucketUrl } from '../constants/bucketBaseUrl';
import { insertResponsiveClasses, hideRequiredIndicator, openFullscreen } from '../utils/surveyEventHandlers';

const props = defineProps({
  appkit: Object,
  standalone: {
    type: Boolean,
    default: false
  },
  userParams: {
    type: Object,
    default: () => ({})
  },
  gameParams: {
    type: Object,
    default: () => ({})
  },
  surveyData: {
    type: Object,
    required: false
  }
});

const progressStatus = ref('survey');
const emit = defineEmits(['completeSurvey']);

const surveyModelRef = ref(null);
const surveyModel = ref(null);

const onComplete = async (sender) => {
  progressStatus.value = 'uploading';
  const responses = sender.data;

  const writeTrialPromises = Object.entries(responses).map(([questionName, answer], index) =>
    props.appkit.writeTrial({
      questionName,
      response: answer,
      itemIndex: index,
      // the next lines are required by backend
      assessment_stage: 'test_response',
      correct: 1,
    })
  );

  await Promise.all(writeTrialPromises).then(() => {
    return props.appkit.finishRun();
  }).then(() => {
    if (!props.standalone) {
      emit('completeSurvey');
    }
    progressStatus.value = 'completed';
  });
}

const createModel = ({survey, theme = themeJson, eventHandlers = {}}) => {
  const model = new Model(survey);
  model.applyTheme(theme);

  for (const [eventName, handlers] of Object.entries(eventHandlers)) {
    handlers.forEach(handler => (
      model[eventName].add(handler)
    ));
  }
  return model;
}

onMounted(async () => {
  await props.appkit.startRun();

  if (!props.standalone) {
    await props.appkit.updateUser(props.userParams);
    const bucketUrl = getBucketUrl();
    const surveyUrl = `${bucketUrl}${ (props.gameParams.survey + '.json') ?? 'survey.json'}`;

    try {
      const response = await fetch(surveyUrl);
      if (!response.ok) throw new Error(`Survey fetch failed: ${response.statusText}`);
      const surveyJson = await response.json();
      surveyModelRef.value = surveyJson;
    } catch (error) {
      console.error('Survey fetch failed:', error);
    }

    const taskParams = {...props.gameParams, taskId: props.appkit.task.taskId};
    await props.appkit.updateTaskParams(taskParams);
  } else {
    surveyModelRef.value = props.surveyData;
  }

  if (surveyModelRef.value) {
    const eventHandlers = {onAfterRenderPage: [insertResponsiveClasses, hideRequiredIndicator, openFullscreen], onComplete: [onComplete]}
    surveyModel.value = createModel({survey: surveyModelRef.value, eventHandlers});
  }
});

</script>

  
