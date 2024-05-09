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

const generateAudioLinks = (parsedLocale) => {
  const fileNames = [
    'ChildSurveyIntro',
    'ClassFriends',
    'ClassHelp',
    'ClassNice',
    'ClassPlay',
    'Example1Comic',
    'Example2Neat',
    'GrowthMindMath',
    'GrowthMindRead',
    'GrowthMindSmart',
    'LearningGood',
    'LonelySchool',
    'MathEnjoy',
    'MathGood',
    'ReadingEnjoy',
    'ReadingGood',
    'SchoolEnjoy',
    'SchoolFun',
    'SchoolGiveUp',
    'SchoolHappy',
    'SchoolSafe',
    'TeacherLike',
    'TeacherListen',
    'TeacherNice',
  ];
  
  const baseURL = `https://storage.googleapis.com/road-dashboard/child-survey/${parsedLocale}/shared/`;
  return fileNames.reduce((acc, curr) => {
    acc[curr] = `${baseURL}${curr}.mp3`;
    return acc;
  }, {}); 
};

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
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

let currentAudioSource = null;

function getParsedLocale() {
  return (locale.value || '').split('-')?.[0] || 'en';
}

function finishedLoading(bufferList, parsedLocale) {
  audioPlayerBuffers.value[parsedLocale] = bufferList;
  audioLoading.value = false;
}

// Function to fetch buffer or return from the cache
const fetchBuffer = (parsedLocale) => {
  // buffer already exists for the given local
  if (audioPlayerBuffers.value[parsedLocale]) {
    return;
  }
  audioLoading.value = true;
  const bufferLoader = new BufferLoader(
    context,
    generateAudioLinks(parsedLocale),
    (bufferList) => finishedLoading(bufferList, parsedLocale)
  );

  bufferLoader.load();
};



// Fetch the survey on component mount
onMounted(async () => {
  await getSurvey();
});

const showAndPlaceAudioButton = (playAudioButton, el) => {
  if (playAudioButton) {
    playAudioButton.classList.add('play-button-visible');
    playAudioButton.style.display = 'flex';
    el.appendChild(playAudioButton);
  }
};

async function getSurvey() {
  let userType = toRaw(authStore.userData.userType.toLowerCase());
  if (userType === 'student') userType = 'child';

  try {
    const response = await axios.get(`https://storage.googleapis.com/road-dashboard/${userType}_survey.json`);
    fetchedSurvey.value = response.data;
    // Create the survey model with the fetched data
    const surveyInstance = new Model(fetchedSurvey.value);

    surveyInstance.locale = locale.value;
    fetchBuffer(getParsedLocale(locale.value));

    survey.value = surveyInstance;
    survey.value.onTextMarkdown.add(function (survey, options) {
      // Convert Markdown to HTML
      let str = converter.makeHtml(options.text);
      // Remove root paragraphs <p></p>
      str = str.substring(3);
      str = str.substring(0, str.length - 4);
      // Set HTML markup to render
      options.html = str;
    });

    survey.value.onComplete.add(saveResults);
    survey.value.onAfterRenderPage.add((__, { htmlElement }) => {
      const questionElements = htmlElement.querySelectorAll('div[id^=sq_]');
      if (questionElements[0].dataset.name !== 'ChildSurveyIntro') {
        if (currentAudioSource) {
          currentAudioSource.stop();
        }
        questionElements.forEach((el) => {
          const playAudioButton = document.getElementById('audio-button-'+ el.dataset.name);
          showAndPlaceAudioButton(playAudioButton, el);
        });
      } else {
        const introButton = document.getElementById('audio-button-ChildSurveyIntro');
        showAndPlaceAudioButton(introButton, questionElements[0]);
      }

    });
  } catch (error) {
    console.error(error);
  }
}

// Watch for changes in vue-i18n locale and update SurveyJS
watch(
  () => locale.value,
  (newLocale) => {
    survey.value.locale = newLocale;
    // stop any current audio playing
    if (currentAudioSource) {
      currentAudioSource.stop();
    }
    fetchBuffer(getParsedLocale(newLocale));
  },
);

async function playAudio(name) {
  const currentLocale = getParsedLocale(locale.value);
  if (currentAudioSource) {
    await currentAudioSource.stop();
  }
  const source = context.createBufferSource();
  currentAudioSource = source;
  source.buffer = audioPlayerBuffers.value[currentLocale][name];
  source.connect(context.destination);
  source.start(0);
}

async function saveResults(sender) {
  console.log('sender.data: ', sender.data);

  // If user did not fill out the survey, do not save the results
  if (Object.keys(sender.data).length === 0) {
    console.log('No data to save');
    // update game store to let game tabs know
    gameStore.requireHomeRefresh();
    gameStore.setSurveyCompleted();
    router.push({ name: 'Home' });
    return;
  }

  // turn on loading state
  isSavingResponses.value = true;

  // call cloud function to save the survey results
  try {
    const res = await roarfirekit.value.saveSurveyResponses(sender.data);
    console.log('response: ', res);

    // update game store to let game tabs know
    gameStore.setSurveyCompleted();

    // route back to game tabs (HomeParticipant)
    gameStore.requireHomeRefresh();
    router.push({ name: 'Home' });
  } catch (error) {
    isSavingResponses.value = false;
    console.error(error);
  }
}
</script>

<template>
  <div v-if="survey && !isSavingResponses && !audioLoading">
    <SurveyComponent :model="survey" />

    <div v-for="page in fetchedSurvey.pages" :key="page.name">
      <div v-for="item in page.elements[0].elements || page.elements" :key="item.name">
        <PvButton :id="'audio-button-'+item.name" icon="pi pi-volume-up" style="display:none;" @click="playAudio(item.name)"/>
      </div>
    </div>

  </div>
  <AppSpinner v-if="!survey || isSavingResponses || audioLoading" />
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
  }
</style>
