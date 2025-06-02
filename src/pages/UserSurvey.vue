<script setup>
import 'survey-core/survey-core.css';
import { SurveyComponent } from 'survey-vue3-ui';
import { useAuthStore } from '@/store/auth';
import AppSpinner from '@/components/AppSpinner.vue';
import { useSurveyStore } from '@/store/survey';
import { useI18n } from 'vue-i18n';
import { AudioContext } from '@/helpers/audio';
import { getParsedLocale } from '@/helpers/survey';
import { onBeforeRouteLeave } from 'vue-router';
import { isLevante } from '@/helpers';
import PvButton from 'primevue/button';
import LevanteSpinner from '@/components/LevanteSpinner.vue';

const authStore = useAuthStore();
const surveyStore = useSurveyStore();
const { locale } = useI18n();
const context = new AudioContext();

onBeforeRouteLeave(() => {
  const surveyStore = useSurveyStore();

  if (isLevante && surveyStore.currentSurveyAudioSource) {
    surveyStore.currentSurveyAudioSource.stop();
  }
});

async function playAudio(name) {
  const currentLocale = getParsedLocale(locale.value);
  if (surveyStore.currentSurveyAudioSource) {
    await surveyStore.currentSurveyAudioSource.stop();
  }
  const source = context.createBufferSource();
  surveyStore.currentSurveyAudioSource = source;
  source.buffer = surveyStore.surveyAudioPlayerBuffers[currentLocale][name];
  source.connect(context.destination);
  source.start(0);
}
</script>

<template>
  <div
    v-if="
      surveyStore.survey &&
      !surveyStore.isSavingSurveyResponses &&
      (!surveyStore.surveyAudioLoading || authStore.userData.userType === 'student')
    "
  >
    <h1
      v-if="authStore.userData.userType !== 'student' && surveyStore.isGeneralSurveyComplete"
      class="text-2xl font-bold text-black text-center"
    >
      {{
        authStore.userData.userType === 'parent'
          ? `${$t('userSurvey.specificRelationDescriptionChildA')} ${
              surveyStore.specificSurveyRelationData[surveyStore.specificSurveyRelationIndex].birthMonth
            } ${$t('userSurvey.specificRelationDescriptionChildB')} ${
              surveyStore.specificSurveyRelationData[surveyStore.specificSurveyRelationIndex].birthYear
            }`
          : `${$t('userSurvey.specificRelationDescriptionClass')} ${
              surveyStore.specificSurveyRelationData[surveyStore.specificSurveyRelationIndex].name
            }`
      }}
    </h1>

    <SurveyComponent :model="surveyStore.survey" />

    <div v-if="authStore.userData.userType === 'student'">
      <div v-for="page in surveyStore.survey.pages" :key="page.name">
        <div v-for="item in page.elements[0].elements || page.elements" :key="item.name">
          <PvButton
            :id="'audio-button-' + item.name"
            icon="pi pi-volume-up text-white"
            style="display: none"
            @click="playAudio(item.name)"
          />
        </div>
      </div>
    </div>
  </div>

  <LevanteSpinner
    v-if="!surveyStore.survey || surveyStore.isSavingSurveyResponses || surveyStore.surveyAudioLoading"
    fullscreen
  />
</template>

<style>
.play-button-visible {
  display: flex;
  position: absolute;
  right: 0;
  left: 500px;
  width: 40px;
  height: 40px;
  background-color: var(--primary-color);
  border: none;
  border-radius: 25%;
}
.play-button-visible:hover {
  background-color: var(--primary-color-hover);
}
</style>
