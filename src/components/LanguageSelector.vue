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

<script setup lang="ts">
import { computed } from 'vue';
import PvSelect from 'primevue/select';
// Assuming SelectChangeEvent is the correct type or create a local interface
// import type { SelectChangeEvent } from 'primevue/select';
import { languageOptions } from '@/translations/i18n';
import { isLevante } from '@/helpers';
import { useSurveyStore } from '@/store/survey';
import { setupStudentAudio } from '@/helpers/surveyInitialization';

// Define an interface for the expected event structure if the import is not available
interface SelectChangeEvent {
  originalEvent: Event; // The original browser event
  value: string; // The new value
}

const surveyStore = useSurveyStore();

// Convert the object to an array of [key, value] pairs
// Assuming languageOptions has a structure like { [key: string]: { language: string, code: string } }
// Let's add a type for clarity
interface LanguageOption {
  language: string;
  code: string;
}

let languageOptionsArray: [string, LanguageOption][] = Object.entries(languageOptions);

// Sort the array by the key (language code)
languageOptionsArray.sort((a, b) => a[0].localeCompare(b[0])); // Sort by key (e.g., 'en', 'es')

// Convert it back to an object
let sortedLanguageOptions: { [key: string]: LanguageOption } = Object.fromEntries(languageOptionsArray);

// Define an interface for the dropdown options
interface DropdownOption {
  name: string;
  code: string;
  value: string;
}

const languageDropdownOptions = computed<DropdownOption[]>(() => {
  return Object.entries(sortedLanguageOptions).map(([key, value]) => {
    return {
      name: value.language,
      code: value.code,
      value: key,
    };
  });
});

async function onLanguageChange(event: SelectChangeEvent): Promise<void> {
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
