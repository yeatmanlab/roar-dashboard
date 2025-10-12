<template>
  <div class="language-picker">
    <PvButton
      v-model="$i18n.locale"
      v-tooltip.top="'Change language'"
      class="p-button-text p-button-rounded m-0 p-0 p-button-plain bg-primary border-2 border-primary hover:surface-200"
      aria-label="Change language"
      @click="toggleMenu($event)"
    >
      <i class="pi pi-globe text-white p-2 m-0 hover:text-primary" style="font-size: 1.1rem"></i>
    </PvButton>

    <PvMenu ref="menu" :model="menuItems" popup />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import PvButton from 'primevue/button';
import PvMenu from 'primevue/menu';
import { useI18n } from 'vue-i18n';
import { languageOptions } from '@/translations/i18n.js';

const { locale } = useI18n({ useScope: 'global' });

const menu = ref(null);

const languageOptionsArray = Object.entries(languageOptions).sort((a, b) => a[0].localeCompare(b[0]));

const menuItems = computed(() =>
  languageOptionsArray.map(([key, value]) => ({
    label: value.language + (locale.value === key ? '  ✓' : ''),
    command: () => {
      locale.value = key;
    },
  })),
);

function toggleMenu(event) {
  menu.value.toggle(event);
}
</script>

<style scoped></style>
