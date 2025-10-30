<template>
  <div class="language-picker">
    <template v-if="props.styleProp === 'home'">
      <PvButton
        v-tooltip.top="$t('navBar.changeLanguage')"
        icon="pi pi-globe"
        class="m-0 p-0 text-primary bg-gray-100 border-none border-round cursor-pointer h-3rem w-3rem text-sm hover:bg-red-900 hover:text-white border-style"
        aria-label="Change language"
        @click="toggleMenu($event)"
      />
    </template>

    <template v-else>
      <a
        href="#"
        class="text-400 w-full inline-block text-left text-sm pt-2 rounded-md hover:text-primary"
        aria-label="Change language"
        @click.prevent="toggleMenu($event)"
      >
        <span>{{ currentLanguageLabel }}</span>
        <i class="pi pi-chevron-down text-sm pl-2" />
      </a>
    </template>

    <PvMenu ref="menu" :model="menuItems" popup />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PvMenu from 'primevue/menu';
import PvButton from 'primevue/button';
import { useI18n } from 'vue-i18n';
import { languageOptions } from '@/translations/i18n.js';

const props = defineProps({
  styleProp: {
    type: String,
    default: 'default', // or 'home'
  },
});

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

<style scoped>
.border-style {
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
}
</style>
