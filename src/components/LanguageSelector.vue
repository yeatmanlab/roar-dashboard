<template>
  <div class="flex align-items-center gap-1">
    <PvSelect
      v-model="$i18n.locale"
      class=""
      :options="languageDropdownOptions"
      option-label="name"
      option-value="value"
      placeholder="Select Language"
      :highlight-on-select="true"
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
import { languageOptions } from '@/translations/i18n.js';

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
