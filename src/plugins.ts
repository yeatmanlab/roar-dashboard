import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
// @ts-ignore - Linter struggles with resolving .js file via alias here, but build works
import router from '@/router/index';
import TextClamp from 'vue3-text-clamp';
import { createHead } from '@unhead/vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { surveyPlugin } from 'survey-vue3-ui';
// @ts-ignore - Linter struggles with resolving .ts file via alias here, but build works
import { i18n } from '@/translations/i18n';
import { createPinia } from 'pinia';
import piniaPluginPersistedState from 'pinia-plugin-persistedstate';
import { definePreset } from '@primevue/themes';
import Aura from '@primevue/themes/aura';

const pinia = createPinia().use(piniaPluginPersistedState);
const head = createHead();

// Define the custom PrimeVue theme preset
const MyPreset = definePreset(Aura, {
  primitive: {
    red: { 500: '#8c1515', 700: '#5b0c0f', 400: '#5b0c0f', 600: '#5b0c0f' },
    surface: { 100: '#adb5bd', 500: '#8c1515' },
  },
  semantic: {
    primary: {
      50: '{surface.200}',
      100: '{surface.300}',
      200: '{red.200}',
      300: '{red.300}',
      400: '{red.400}',
      500: '{red.500}',
      600: '{red.600}',
      700: '{red.700}',
      800: '{red.800}',
      900: '{red.900}',
      950: '{red.950}',
    },
  },
});

const plugins = [
  [
    PrimeVue, 
    {
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: 'dark-mode',
        },
      },
      ripple: true,
    },
  ],
  [
    VueQueryPlugin,
    {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: (window as any).Cypress ? 0 : 10 * 60 * 1000,
            gcTime: (window as any).Cypress ? 0 : 15 * 60 * 1000,
          },
        },
      },
    },
  ],
  ConfirmationService,
  ToastService,
  router,
  TextClamp,
  head,
  surveyPlugin,
  i18n,
  pinia,
];

export default plugins;
