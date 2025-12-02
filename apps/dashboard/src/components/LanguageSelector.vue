<template>
  <div class="language-picker">
    <!-- HOME STYLE -->
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

    <!-- DEFAULT STYLE: TRIGGER -->
    <template v-else>
      <PvButton
        class="text-400 w-8 inline-block text-left text-sm pt-2 rounded-md hover:text-primary underline button-link"
        :aria-label="$t('navBar.changeLanguage')"
        aria-haspopup="menu"
        :aria-expanded="menuVisible ? 'true' : 'false'"
        @click="toggleMenu"
      >
        <span>{{ currentLanguageLabel }}</span>
        <i class="pi pi-chevron-down text-sm pl-2" aria-hidden="true" />
      </PvButton>
    </template>

    <!-- MENU -->
    <PvMenu ref="menu" :model="menuItems" popup role="menu" @show="menuVisible = true" @hide="menuVisible = false">
      <template #item="{ item, props: slotProps }">
        <PvButton
          v-bind="slotProps.action"
          class="w-full text-left hover:text-primary button-link"
          role="menuitemradio"
          :aria-checked="item.key === locale ? 'true' : 'false'"
          :tabindex="item.key === locale ? 0 : -1"
          @click="onSelect(item.key)"
        >
          <span aria-hidden="true">{{ item.key === locale ? '✓ ' : '' }}</span>
          <span>{{ item.label }}</span>
        </PvButton>
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

const menuItems = computed(() =>
  Object.entries(languageOptions).map(([key, value]) => ({
    key,
    label: value.language,
  })),
);

const currentLanguageLabel = computed(() => {
  const current = languageOptions[locale.value];
  return current ? current.language : t('languageSelector.selectLanguage', 'Select Language');
});

function toggleMenu(event) {
  menu.value?.toggle(event);
}

function onSelect(key) {
  if (key !== locale.value) {
    locale.value = key;
  }
  menu.value?.hide();
}
</script>

<style scoped>
.border-style {
  outline: 1.2px solid rgba(0, 0, 0, 0.1);
}
.button-link {
  background-color: transparent !important;
  border: none !important;
}
</style>
