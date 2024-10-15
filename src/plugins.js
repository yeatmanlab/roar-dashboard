import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import router from '@/router/index.js';
import TextClamp from 'vue3-text-clamp';
import VueGoogleMaps from 'vue-google-maps-community-fork';
import { createHead } from '@unhead/vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { surveyPlugin } from 'survey-vue3-ui';
import { i18n } from '@/translations/i18n.js';
import { createPinia } from 'pinia';
import piniaPluginPersistedState from 'pinia-plugin-persistedstate';

const pinia = createPinia().use(piniaPluginPersistedState);
const head = createHead();

const plugins = [
  [PrimeVue, { ripple: true }],
  [
    VueQueryPlugin,
    {
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: window.Cypress ? 0 : 10 * 60 * 1000,
            gcTime: window.Cypress ? 0 : 15 * 60 * 1000,
          },
        },
      },
    },
  ],
  [
    VueGoogleMaps,
    {
      load: {
        key: 'AIzaSyA2Q2Wq5na79apugFwoTXKyj-RTDDR1U34',
        libraries: 'places',
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
