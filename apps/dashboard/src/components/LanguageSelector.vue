<template>
  <div class="language-picker">
    <template v-if="props.styleProp === 'home'">
      <PvButton
        v-tooltip.top="$t('navBar.changeLanguage')"
        icon="pi pi-globe"
        class="m-0 p-0 text-primary bg-gray-100 border-none border-round cursor-pointer h-3rem w-3rem text-sm hover:bg-red-900 hover:text-white border-style"
        :aria-label="$t('navBar.changeLanguage')"
        aria-haspopup="menu"
        :aria-expanded="menuVisible ? 'true' : 'false'"
        @click="toggleMenu"
      />
    </template>

    <template v-else>
      <a
        href="#"
        class="text-400 w-full inline-block text-left text-sm pt-2 rounded-md hover:text-primary"
        :aria-label="$t('navBar.changeLanguage')"
        aria-haspopup="menu"
        :aria-expanded="menuVisible ? 'true' : 'false'"
        @click.prevent="toggleMenu"
      >
        <span>{{ currentLanguageLabel }}</span>
        <i class="pi pi-chevron-down text-sm pl-2" aria-hidden="true" />
      </a>
    </template>

    <PvMenu ref="menu" :model="menuItems" popup role="menu" @show="menuVisible = true" @hide="menuVisible = false">
      <!-- Accessible item template -->
      <template #item="{ item, props: slotProps }">
        <a
          v-bind="slotProps.action"
          role="menuitemradio"
          :aria-checked="item.key === locale ? 'true' : 'false'"
          :tabindex="item.key === locale ? 0 : -1"
          @click.prevent="onSelect(item.key)"
        >
          <!-- Visual checkmark, hidden from AT -->
          <span aria-hidden="true">{{ item.key === locale ? '✓ ' : '' }}</span>
          <span>{{ item.label }}</span>
        </a>
      </template>
    </PvMenu>
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
    default: 'default',
  },
});

const { locale, t } = useI18n({ useScope: 'global' });
const menu = ref(null);
const menuVisible = ref(false);

// Build menu items once; labels from languageOptions
const menuItems = computed(() =>
  Object.entries(languageOptions).map(([key, value]) => ({
    key,
    label: value.language,
  })),
);

// Current language label
const currentLanguageLabel = computed(() => {
  const current = languageOptions[locale.value];
  return current ? current.language : t('languageSelector.selectLanguage', 'Select Language');
});

function toggleMenu(event) {
  menu.value?.toggle(event);
}

function onSelect(key) {
  if (key && key !== locale.value) {
    locale.value = key;
  }
  menu.value?.hide();
}
</script>

<style scoped>
.border-style {
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
}
</style>
