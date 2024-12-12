<template>
  <div class="card flex justify-center w-full">
    <PvSelect
      v-model="selectedLanguage"
      class="w-full md:w-56 bg-white"
      :options="languageDropdownOptions"
      option-label="name"
      option-value="value"
      :placeholder="$t('authSignIn.selectLanguage')"
      :highlight-on-select="true"
    >
    </PvSelect>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import PvSelect from 'primevue/select';
import { languageOptions } from '@/translations/i18n.js';

const selectedLanguage = ref();

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
</script>

<style scoped></style>
