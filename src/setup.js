import { createApp } from 'vue';
import { VueRecaptchaPlugin } from 'vue-recaptcha';
import { Buffer } from 'buffer';
import { initSentry } from '@/sentry';
import PvTooltip from 'primevue/tooltip';
import App from '@/App.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import plugins from './plugins';
import './styles.css';
import Aura from '@primevue/themes/aura';
import { definePreset } from '@primevue/themes';
import PrimeVue from 'primevue/config';

/**
 * Create Vue App
 *
 * @returns {App<Element>}
 */
export const createAppInstance = () => {
  const app = createApp(App);

  // Register all app plugins.
  plugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      app.use(...plugin);
    } else {
      app.use(plugin);
    }
  });

  // Register plugins.
  // @NOTE: This plugin is intentionally loaded outside of the plugins.js file to prevent the reCAPTCHA from being
  // loaded inside the Cypress component tests. As Cypress component tests currently load the plugins.js file directly,
  // any other plugins that should not be loaded in the Cypress tests should be loaded below.
  app.use(VueRecaptchaPlugin, {
    v3SiteKey: '6Lc-LXsnAAAAAHGha6zgn0DIzgulf3TbGDhnZMAd',
  });

  // Register global components.
  app.component('AppSpinner', AppSpinner);

  // Register global directives.
  app.directive('tooltip', PvTooltip);

  // Register global variables.
  // eslint-disable-next-line no-undef
  globalThis.Buffer = Buffer;

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

  app.use(PrimeVue, {
    theme: {
      preset: MyPreset,
      options: {
        darkModeSelector: 'dark-mode',
      },
    },
    ripple: true,
  });

  if (process.env.NODE_ENV === 'production') {
    initSentry(app);
  }

  return app;
};

/**
 * Mount App
 *
 * @returns {void}
 */
export const mountApp = () => {
  const app = createAppInstance();
  app.mount('#app');
};
