<script setup>
import 'survey-core/defaultV2.min.css';
import { Model } from 'survey-core';
import { onMounted, ref, toRaw, watch } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';
// import { storeToRefs } from 'pinia';
import AppSpinner from '@/components/AppSpinner.vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '@/store/game';
import { Converter } from 'showdown';
import { useI18n } from 'vue-i18n';
import { BufferLoader, AudioContext } from '@/helpers/audio';
import { useToast } from 'primevue/usetoast';
import PvButton from 'primevue/button';

const fetchAudioLinks = async (surveyType) => {
  const response = await axios.get('https://storage.googleapis.com/storage/v1/b/road-dashboard/o/');
  const files = response.data || { items: [] };
  const audioLinkMap = {};
  files.items.forEach((item) => {
    if (item.contentType === 'audio/mpeg' && item.name.startsWith(surveyType)) {
      const splitParts = item.name.split('/');
      const fileLocale = splitParts[1];
      const fileName = splitParts.at(-1).split('.')[0];
      if (!audioLinkMap[fileLocale]) {
        audioLinkMap[fileLocale] = {};
      }
      audioLinkMap[fileLocale][fileName] = `https://storage.googleapis.com/road-dashboard/${item.name}`;
    }
  });
  return audioLinkMap;
};

const authStore = useAuthStore();
// const { roarfirekit } = storeToRefs(authStore);
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
  const bufferLoader = new BufferLoader(context, audioLinks.value[parsedLocale], (bufferList) =>
    finishedLoading(bufferList, parsedLocale),
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
    const audioLinkMap = await fetchAudioLinks('child-survey');
    audioLinks.value = audioLinkMap;
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
      if (currentAudioSource) {
        currentAudioSource.stop();
      }
      questionElements.forEach((el) => {
        const playAudioButton = document.getElementById('audio-button-' + el.dataset.name);
        showAndPlaceAudioButton(playAudioButton, el);
      });
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
  // If user did not fill out the survey, do not save the results
  if (Object.keys(sender.data).length === 0) {
    // update game store to let game tabs know
    gameStore.requireHomeRefresh();
    gameStore.setSurveyCompleted();
    router.push({ name: 'Home' });
    return;
  }

  // turn on loading state
  isSavingResponses.value = true;

  // call cloud function to save the survey results
  // TODO: Use tanstack-query mutation for automaitic retries.
  try {
    // const res = await roarfirekit.value.saveSurveyResponses(sender.data);

    // update game store to let game tabs know
    gameStore.setSurveyCompleted();

    // route back to game tabs (HomeParticipant)
    gameStore.requireHomeRefresh();
    router.push({ name: 'Home' });
  } catch (error) {
    isSavingResponses.value = false;
    console.error(error);
    toast.add({
      severity: 'error',
      summary: 'Error saving survey responses: ' + error.message,
      life: 3000,
    });
  }
}
</script>

<template>
  <div v-if="survey && !isSavingResponses && !audioLoading">
    <!-- eslint-disable-next-line vue/no-undef-components -->
    <SurveyComponent :model="survey" />

    <div v-for="page in fetchedSurvey.pages" :key="page.name">
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
  background-color: var(--primary-color);
  border: none;
  border-radius: 25%;
}
.play-button-visible:hover {
  background-color: var(--primary-color-hover);
}
</style>
