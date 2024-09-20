<script setup>
import 'survey-core/defaultV2.min.css';
import { Model } from 'survey-core';
import { onMounted, ref, toRaw, watch } from 'vue';
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

// const STORAGE_ITEM_KEY = 'levante-survey';

// Fetch the survey on component mount
// onMounted(async () => {
//   await getSurvey();
// });

const { isLoading, data: surveyResponsesData, refetch: refetchSurveyResponses } = useSurveyResponses(undefined, shouldFetchSurveyResponses);

// const fetchAudioLinks = async (surveyType) => {
//   const response = await axios.get('https://storage.googleapis.com/storage/v1/b/road-dashboard/o/');
//   const files = response.data || { items: [] };
//   const audioLinkMap = {};
//   files.items.forEach((item) => {
//     if (item.contentType === 'audio/mpeg' && item.name.startsWith(surveyType)) {
//       const splitParts = item.name.split('/');
//       const fileLocale = splitParts[1];
//       const fileName = splitParts.at(-1).split('.')[0];
//       if (!audioLinkMap[fileLocale]) {
//         audioLinkMap[fileLocale] = {};
//       }
//       audioLinkMap[fileLocale][fileName] = `https://storage.googleapis.com/road-dashboard/${item.name}`;
//     }
//   });
//   return audioLinkMap;
// };


// let currentAudioSource = null;

// function getParsedLocale() {
//   return (locale.value || '').split('-')?.[0] || 'en';
// }

// function finishedLoading(bufferList, parsedLocale) {
//   audioPlayerBuffers.value[parsedLocale] = bufferList;
//   audioLoading.value = false;
// }

// // Function to fetch buffer or return from the cache
// const fetchBuffer = (parsedLocale) => {
//   // buffer already exists for the given local
//   if (audioPlayerBuffers.value[parsedLocale]) {
//     return;
//   }
//   audioLoading.value = true;
//   const bufferLoader = new BufferLoader(context, audioLinks.value[parsedLocale], (bufferList) =>
//     finishedLoading(bufferList, parsedLocale),
//   );

//   bufferLoader.load();
// };


// const showAndPlaceAudioButton = (playAudioButton, el) => {
//   if (playAudioButton) {
//     playAudioButton.classList.add('play-button-visible');
//     playAudioButton.style.display = 'flex';
//     el.appendChild(playAudioButton);
//   }
// };

// async function saveSurveyData(survey) {
//   const data = survey.data;
//   data.pageNo = survey.currentPageNo;
//   window.localStorage.setItem(`${STORAGE_ITEM_KEY}-${uid.value}`, JSON.stringify(data));
//   await roarfirekit.value.saveSurveyResponses({
//     responses: data,
//     administrationId: gameStore?.selectedAdmin?.id ?? null,
//   });
// }

// async function restoreSurveyData(survey) {
//   const prevData = window.localStorage.getItem(`${STORAGE_ITEM_KEY}-${uid.value}`) || null;
//   if (prevData) {
//     const data = JSON.parse(prevData);
//     survey.data = data;
//     if (data.pageNo) {
//       survey.currentPageNo = data.pageNo;
//     }
//   } else {
//     shouldFetchSurveyResponses = true;
//     await refetchSurveyResponses();

//     if (surveyResponsesData.value) {
//       // find the survey response doc with the correspoding administrationId
//       const surveyResponse = surveyResponsesData.value.find((doc) => doc?.administrationId === gameStore.selectedAdmin?.id);
//       if (surveyResponse) {
//         survey.data = surveyResponse;

//         if (surveyResponse.pageNo) {
//           survey.currentPageNo = surveyResponse.pageNo;
//         }
//       }
//     }
//     // If there's no data in localStorage and no data from the server,
//     // the survey has never been started, so we continue with an empty survey
//   }
// }

// async function getSurvey() {
//   let userType = toRaw(authStore.userData.userType.toLowerCase());
//   if (userType === 'student') userType = 'child';

//   try {
//     // const response = await axios.get(`https://storage.googleapis.com/road-dashboard/${userType}_survey.json`);

//     const audioLinkMap = await fetchAudioLinks('child-survey');
//     audioLinks.value = audioLinkMap;

//     // fetchedSurvey.value = response.data;
//     // const surveyInstance = new Model(fetchedSurvey.value);

//     surveyInstance.locale = locale.value;
//     fetchBuffer(getParsedLocale(locale.value));

//     survey.value = surveyInstance;
//     survey.value.onTextMarkdown.add(function (survey, options) {
//       // Convert Markdown to HTML
//       let str = converter.makeHtml(options.text);
//       // Remove root paragraphs <p></p>
//       str = str.substring(3);
//       str = str.substring(0, str.length - 4);
//       // Set HTML markup to render
//       options.html = str;
//     });

//     survey.value.onAfterRenderPage.add((__, { htmlElement }) => {
//       const questionElements = htmlElement.querySelectorAll('div[id^=sq_]');
//       if (currentAudioSource) {
//         currentAudioSource.stop();
//       }
//       questionElements.forEach((el) => {
//         const playAudioButton = document.getElementById('audio-button-' + el.dataset.name);
//         showAndPlaceAudioButton(playAudioButton, el);
//       });
//     });

//     // Restore survey data from localStorage
//     await restoreSurveyData(survey.value);

//     // Save survey results when users change a question value or switch to the next page
//     survey.value.onValueChanged.add(saveSurveyData);
//     survey.value.onCurrentPageChanged.add(saveSurveyData);
//     // Need to have this as well to save all the responses, even if the user doesn't respond to all the questions
//     survey.value.onComplete.add(saveResults);

//   } catch (error) {
//     console.error(error);
//   }
// }

// Watch for changes in vue-i18n locale and update SurveyJS
// watch(
//   () => locale.value,
//   (newLocale) => {
//     const surveyInstance = gameStore.survey;
//     surveyInstance.locale = newLocale;

//     gameStore.setSurvey(surveyInstance);

//     // stop any current audio playing
//     if (gameStore.currentSurveyAudioSource) {
//       gameStore.currentSurveyAudioSource.stop();
//     }

//     fetchBuffer(getParsedLocale(newLocale));
//   },
// );

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

// async function saveResults(sender) {
//   const allQuestions = sender.getAllQuestions();
//   const unansweredQuestions = {};

//   allQuestions.forEach((question) => (unansweredQuestions[question.name] = null));

//   // Values from the second object overwrite values from the first
//   const responsesWithAllQuestions = _merge(unansweredQuestions, sender.data);
//   // remove pageNo, used for continuing incomplete survey, from the responses
//   delete responsesWithAllQuestions.pageNo;

//   // turn on loading state
//   isSavingResponses.value = true;

//   // call cloud function to save the survey results
//   // TODO: Use tanstack-query mutation for automaitic retries.
//   try {
//     await roarfirekit.value.saveSurveyResponses({
//       responses: responsesWithAllQuestions,
//       administrationId: gameStore?.selectedAdmin?.id ?? null,
//     });

//     // update game store to let game tabs know
//     gameStore.setSurveyCompleted();
//     queryClient.invalidateQueries({ queryKey: ['surveyResponses', uid] });

//     // Clear localStorage after successful submission
//     window.localStorage.removeItem(`${STORAGE_ITEM_KEY}-${uid.value}`);

//     gameStore.requireHomeRefresh();
//     router.push({ name: 'Home' });
//   } catch (error) {
//     isSavingResponses.value = false;
//     console.error(error);
//     toast.add({
//       severity: 'error',
//       summary: 'Error saving survey responses: ' + error.message,
//       life: 3000,
//     });
//   }
// }
</script>

<template>
  <div v-if="gameStore.survey && !gameStore.isSavingSurveyResponses && !gameStore.surveyAudioLoading">
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
  <AppSpinner v-if="!gameStore.survey || !gameStore.isSavingSurveyResponses || gameStore.surveyAudioLoading" />
  <!-- <SurveyComponent :model="gameStore.survey" /> -->
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
