<template>
  <div class="language-picker">
    <a
      href="#"
      class="text-400 w-full inline-block text-left text-sm pt-2 rounded-md underline hover:text-primary"
      aria-label="Change language"
      @click.prevent="toggleMenu($event)"
    >
      <span>{{ currentLanguageLabel }}</span>
      <i class="pi pi-chevron-down text-sm pl-2" />
    </a>

    <PvMenu ref="menu" :model="menuItems" popup />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PvMenu from 'primevue/menu';
import { useI18n } from 'vue-i18n';
import { languageOptions } from '@/translations/i18n.js';

const { locale } = useI18n({ useScope: 'global' });
const menu = ref(null);

// Sort languages alphabetically
const languageOptionsArray = Object.entries(languageOptions).sort((a, b) => a[0].localeCompare(b[0]));

// Build the menu items
const menuItems = computed(() =>
  languageOptionsArray.map(([key, value]) => ({
    label: value.language + (locale.value === key ? '  ✓' : ''),
    command: () => {
      locale.value = key;
    },
  })),
);

// Display current language label
const currentLanguageLabel = computed(() => {
  const current = languageOptions[locale.value];
  return current ? current.language : 'Select Language';
});

function toggleMenu(event) {
  menu.value.toggle(event);
}
</script>
