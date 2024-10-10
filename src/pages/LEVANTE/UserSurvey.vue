<script setup>
import 'survey-core/defaultV2.min.css';
import { Model } from 'survey-core';
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import AppSpinner from '@/components/AppSpinner.vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/store/game';
import { Converter } from 'showdown';
import { useI18n } from 'vue-i18n';
import { BufferLoader, AudioContext } from '@/helpers/audio';
import { useToast } from 'primevue/usetoast';
import { useQueryClient } from '@tanstack/vue-query';
import _merge from 'lodash/merge';
import useSurveyResponses from '@/composables/useSurveyResponses/useSurveyResponses';
import { getParsedLocale } from '@/helpers/survey';



const authStore = useAuthStore();
const { roarfirekit, uid } = storeToRefs(authStore);
const fetchedSurvey = ref(null);
const survey = ref(null);
const isSavingResponses = ref(false);
const gameStore = useGameStore();
const converter = new Converter();
const { locale } = useI18n();
const audioPlayerBuffers = ref({});
const audioLoading = ref(false);
const router = useRouter();
const context = new AudioContext();
const audioLinks = ref({});
const toast = useToast();
const queryClient = useQueryClient();
let shouldFetchSurveyResponses = false;



const { isLoading, data: surveyResponsesData, refetch: refetchSurveyResponses } = useSurveyResponses(undefined, shouldFetchSurveyResponses);



// Watch for changes in vue-i18n locale and update SurveyJS
watch(
  () => locale.value,
  (newLocale) => {
    const surveyInstance = gameStore.survey;
    surveyInstance.locale = newLocale;

    gameStore.setSurvey(surveyInstance);

    // stop any current audio playing
    if (gameStore.currentSurveyAudioSource) {
      gameStore.currentSurveyAudioSource.stop();
    }

    // fetchBuffer(getParsedLocale(newLocale));
  },
);

async function playAudio(name) {
  const currentLocale = getParsedLocale(locale.value);
  if (gameStore.currentSurveyAudioSource) {
    await gameStore.currentSurveyAudioSource.stop();
  }
  const source = context.createBufferSource();
  gameStore.currentSurveyAudioSource = source;
  source.buffer = gameStore.surveyAudioPlayerBuffers[currentLocale][name];
  source.connect(context.destination);
  source.start(0);
}

console.log('specificSurveyRelationData', gameStore.specificSurveyRelationData)
console.log('specificSurveyRelationIndex', gameStore.specificSurveyRelationIndex)
console.log('speciufic relation:', gameStore.specificSurveyRelationData[gameStore.specificSurveyRelationIndex])


</script>

<template>
  <div v-if="gameStore.survey && !gameStore.isSavingSurveyResponses && (!gameStore.surveyAudioLoading || authStore.userData.userType === 'student')">
    <h1 v-if="authStore.userData.userType !== 'student' && gameStore.isGeneralSurveyComplete" class="text-2xl font-bold text-black text-center">
      {{ authStore.userData.userType === 'parent' ? `${$t('userSurvey.specificRelationDescriptionChildA')} ${gameStore.specificSurveyRelationData[gameStore.specificSurveyRelationIndex].birthMonth} ${$t('userSurvey.specificRelationDescriptionChildB')} ${gameStore.specificSurveyRelationData[gameStore.specificSurveyRelationIndex].birthYear}` : `${$t('userSurvey.specificRelationDescriptionClass')} ${gameStore.specificSurveyRelationData[gameStore.specificSurveyRelationIndex].name}` }}
    </h1>
    
    <SurveyComponent :model="gameStore.survey" />

    <div v-if="authStore.userData.userType === 'student'">
      <div v-for="page in gameStore.survey.pages" :key="page.name">
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

  <AppSpinner v-if="!gameStore.survey || gameStore.isSavingSurveyResponses || (gameStore.surveyAudioLoading && authStore.userData.userType !== 'student')" />
</template>

<style>
  .play-button-visible {
    display: flex;
    position: absolute;
    right: 0;
    top: 0;
    margin-top: -36px;
    margin-right: -36px;
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
