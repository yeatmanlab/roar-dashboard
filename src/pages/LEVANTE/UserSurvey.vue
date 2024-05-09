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

const authStore = useAuthStore();
const { roarfirekit } = storeToRefs(authStore);
const fetchedSurvey = ref(null);
const survey = ref(null);
const isSavingResponses = ref(false);
const gameStore = useGameStore();
const converter = new Converter();
const { locale } = useI18n();

const router = useRouter();

// Fetch the survey on component mount
onMounted(async () => {
  await getSurvey();
});

async function getSurvey() {
  let userType = toRaw(authStore.userData.userType.toLowerCase());
  if (userType === 'student') userType = 'child';

  try {
    const response = await axios.get(`https://storage.googleapis.com/road-dashboard/${userType}_survey`);
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
  } catch (error) {
    console.error(error);
  }
}

// Watch for changes in vue-i18n locale and update SurveyJS
watch(
  () => locale.value,
  (newLocale) => {
    survey.value.locale = newLocale;
  },
);

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
  </div>
  <AppSpinner v-if="!survey || isSavingResponses" />
</template>

<style></style>
