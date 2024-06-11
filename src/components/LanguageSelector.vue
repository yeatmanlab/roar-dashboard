<template>
  <div class="flex align-items-center gap-1">
    <PvDropdown
      v-model="$i18n.locale"
      class=""
      :options="languageDropdownOptions"
      option-label="name"
      option-value="value"
      placeholder="Select language"
      :highlight-on-select="true"
    >
      <template #header>
        <div class="m-2 font-bold uppercase text-sm text-gray-500">Set Locale</div>
      </template>
      <template #value="locale">
        <div v-if="locale.value" class="flex flex-row justify-content-center align-items-center">
          <country-flag :country="getCountryFlag(locale.value)" class="flex" size="small" />
        </div>
        <span v-else>
          {{ locale.placeholder }}
        </span>
      </template>
      <template #option="country">
        <div class="flex flex-row justify-content-start align-items-center">
          <country-flag :country="country.option.code" class="mr-2" size="small" />
          <span>{{ country.option.name }}</span>
        </div>
      </template>
    </PvDropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { languageOptions } from '@/translations/i18n.js';
import CountryFlag from 'vue-country-flag-next';

// Convert the object to an array of [key, value] pairs
let languageOptionsArray = Object.entries(languageOptions);

// Sort the array by the key (language code)
languageOptionsArray.sort((a, b) => a[0].localeCompare(b[1]));

// Convert it back to an object
let sortedLanguageOptions = Object.fromEntries(languageOptionsArray);

const languageDropdownOptions = computed(() => {
  return Object.entries(sortedLanguageOptions).map(([key, value]) => {
    return {
      name: value.country,
      code: value.code,
      value: key,
    };
  });
});

const getCountryFlag = (locale) => {
  return languageOptions[locale].code;
};
</script>

<style scoped></style>
