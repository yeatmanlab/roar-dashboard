<template>
  <div class="language-selector-wrapper">
    <div class="font-semibold text-color-secondary">{{ $t('authSignIn.selectLanguageLabel') }}:</div>

    <PvSelect
      v-model="$i18n.locale"
      class="w-full"
      :options="languageDropdownOptions"
      option-label="name"
      option-value="value"
      :placeholder="$t('authSignIn.selectLanguage')"
      :highlight-on-select="true"
      @change="onLanguageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import PvSelect from 'primevue/select';
import { languageOptions } from '@/translations/i18n';
import { isLevante } from '@/helpers';
import { useSurveyStore } from '@/store/survey';
import { setupStudentAudio } from '@/helpers/surveyInitialization';
import { getParsedLocale } from '@/helpers/survey';

interface LanguageOption {
  name: string;
  code: string;
  value: string;
}

interface LanguageChangeEvent {
  value: string;
}

const surveyStore = useSurveyStore();

// Convert the object to an array of [key, value] pairs
const languageOptionsArray: [string, any][] = Object.entries(languageOptions);

// Sort the array by the key (language code)
languageOptionsArray.sort((a, b) => a[0].localeCompare(b[1]));

// Convert it back to an object
const sortedLanguageOptions: Record<string, any> = Object.fromEntries(languageOptionsArray);

const languageDropdownOptions = computed((): LanguageOption[] => {
  return Object.entries(sortedLanguageOptions).map(([key, value]) => {
    return {
      name: value.language,
      code: value.code,
      value: key,
    };
  });
});

async function onLanguageChange(event: LanguageChangeEvent): Promise<void> {
  sessionStorage.setItem(`${isLevante ? 'levante' : 'roar'}PlatformLocale`, event.value);

  console.log('event', event.value);

  if (isLevante && surveyStore.survey) {
    console.log('setting survey locale');
    (surveyStore.survey as any).locale = getParsedLocale(event.value);
    await setupStudentAudio(surveyStore.survey as any, event.value, surveyStore.audioLinkMap, surveyStore);
  }
}
</script>

<style lang="scss">
.language-selector-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.p-select-label {
  text-align: left;
}
</style>
