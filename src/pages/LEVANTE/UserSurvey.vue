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

function BufferLoader(context, urlListMap, callback) {
  this.context = context;
  this.urlListMap = urlListMap;
  this.onload = callback;
  this.bufferList = new Array();
  this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function(url, index) {
  // Load buffer asynchronously
  var request = new XMLHttpRequest();
  request.open("GET", url, true);
  request.responseType = "arraybuffer";

  var loader = this;

  request.onload = function() {
    // Asynchronously decode the audio file data in request.response
    loader.context.decodeAudioData(
      request.response,
      function(buffer) {
        if (!buffer) {
          alert('error decoding file data: ' + url);
          return;
        }
        loader.bufferList[index] = buffer;
        if (++loader.loadCount === Object.keys(loader.urlListMap).length)
          loader.onload(loader.bufferList);
      },
      function(error) {
        console.error('decodeAudioData error', error);
      }
    );
  }

  request.onerror = function() {
    // alert('BufferLoader: XHR error');
  }

  request.send();
}

BufferLoader.prototype.load = function() {
  Object.keys(this.urlListMap).forEach((key, index) => {
    this.loadBuffer(this.urlListMap[key], key);
  });  
}

const generateAudioLinks = () => {
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
  // TODO: Make this sensitive to the language
  // For now, it is hardcoded to spanish
  const baseURL = 'https://storage.googleapis.com/child-questionnaire/es/shared/';
  return fileNames.reduce((acc, curr) => {
    // acc[curr] = `${baseURL}${curr}.mp3`;
    const rand = Math.random();
    if (rand < 0.2) {
      acc[curr] = 'https://storage.googleapis.com/theory-of-mind/en/shared/ToM-scene2-q3-false_belief.mp3';
    } else if (rand >= 0.2 && rand < 0.5) {
      acc[curr] = 'https://storage.googleapis.com/theory-of-mind/en/shared/ToM-scene2-instruct2.mp3';
    } else {
      acc[curr] = 'https://storage.googleapis.com/theory-of-mind/en/shared/ToM-scene3-instruct1.mp3';
    }
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
const audioPlayerBuffers = ref([]);

const router = useRouter();
let AudioContext = window.AudioContext || window.webkitAudioContext;
const context = new AudioContext();
let currentAudioSource = null;

function finishedLoading(bufferList) {
  audioPlayerBuffers.value = bufferList;
}

const bufferLoader = new BufferLoader(
  context,
  generateAudioLinks(),
  finishedLoading
);

bufferLoader.load();

// Fetch the survey on component mount
onMounted(async () => {
  console.log('mark://', 'on getStore');
  await getSurvey();
});

const showAndPlaceAudioButton = (playAudioButton, el) => {
  if (playAudioButton) {
    playAudioButton.style.display = 'inline-block';
    playAudioButton.style.position = 'absolute';
    playAudioButton.style.right = 0;
    playAudioButton.style.top = 0;
    el.appendChild(playAudioButton);
  }
};

async function getSurvey() {
  // let userType = toRaw(authStore.userData.userType.toLowerCase());
  // if (userType === 'student') userType = 'child';
  const userType = 'child';
  try {
    const response = await axios.get(`https://storage.googleapis.com/road-dashboard/${userType}_survey.json`);
    fetchedSurvey.value = response.data;
    // Create the survey model with the fetched data
    const surveyInstance = new Model(fetchedSurvey.value);

    surveyInstance.locale = locale.value;

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
        // const introButton = document.getElementById('audio-button-ChildSurveyIntro');
        // introButton.style.display = 'none';
        questionElements.forEach((el) => {
          const playAudioButton = document.getElementById('audio-button-'+ el.dataset.name);
          showAndPlaceAudioButton(playAudioButton, el);
        });
      } else {
        const introButton = document.getElementById('audio-button-ChildSurveyIntro');
        showAndPlaceAudioButton(introButton, questionElements[0]);
        // console.log('mark://in intro', 'introButton', introButton);
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
    console.log(document.getElementById('sq_102'));
  },
);

async function playAudio(name) {
  if (currentAudioSource) {
    await currentAudioSource.stop();
  }
  const source = context.createBufferSource();
  currentAudioSource = source;
  source.buffer = audioPlayerBuffers.value[name];
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
  <div v-if="survey && !isSavingResponses">
    <SurveyComponent :model="survey" />
    <div v-for="page in fetchedSurvey.pages">
      <div v-for="(item, index) in page.elements[0].elements || page.elements">
        <button :id="'audio-button-'+item.name" @click="playAudio(item.name)" style="display:none;">Play Audio {{item.name}}</button>
      </div>
    </div>

  </div>
  <AppSpinner v-if="!survey || isSavingResponses" />
</template>

<style></style>
