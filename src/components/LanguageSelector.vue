<template>
  <div class="card flex justify-center w-full">
    <PvSelect
      v-model="$i18n.locale"
      class="w-full md:w-56 bg-white"
      :options="languageDropdownOptions"
      option-label="name"
      option-value="value"
      :placeholder="$t('authSignIn.selectLanguage')"
      :highlight-on-select="true"
      @change="onLanguageChange"
    >
      <template #header>
        <small class="m-2 font-bold uppercase text-gray-400">
          {{ $t('authSignIn.selectLanguage') }}
        </small>
      </template>
    </PvSelect>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PvSelect from 'primevue/select';
import { languageOptions } from '@/translations/i18n.js';
import { isLevante } from '@/helpers';
import { useSurveyStore } from '@/store/survey';
import { setupStudentAudio } from '@/helpers/surveyInitialization';

const surveyStore = useSurveyStore();

// Convert the object to an array of [key, value] pairs
let languageOptionsArray = Object.entries(languageOptions);

// Sort the array by the key (language code)
languageOptionsArray.sort((a, b) => a[0].localeCompare(b[1]));

// Convert it back to an object
let sortedLanguageOptions = Object.fromEntries(languageOptionsArray);

const languageDropdownOptions = computed(() => {
  return Object.entries(sortedLanguageOptions).map(([key, value]) => {
    return {
      name: value.language,
      code: value.code,
      value: key,
    };
  });
});

async function onLanguageChange(event) {
  sessionStorage.setItem(`${isLevante ? 'levante' : 'roar'}PlatformLocale`, event.value);

  console.log('event', event.value);

  if (isLevante && surveyStore.survey) {
    console.log('setting survey locale');
    surveyStore.survey.locale = event.value;
    await setupStudentAudio(surveyStore.survey, event.value, surveyStore.audioLinkMap, surveyStore);
  }
}
</script>

<style scoped></style>
