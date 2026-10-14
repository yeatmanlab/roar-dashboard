import { createApp } from 'vue';
import { VueRecaptchaPlugin } from 'vue-recaptcha';
import { Buffer } from 'buffer';
import { initSentry } from '@/sentry';
import PvTooltip from 'primevue/tooltip';
import App from '@/App.vue';
import AppSpinner from '@/components/AppSpinner.vue';
import { createAuthService } from '@/services/AuthService';
import plugins from './plugins';
import './styles.css';

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

  globalThis.Buffer = Buffer;

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
  // Create the AuthService singleton BEFORE mounting, so the router's
  // `beforeEach` auth-readiness gate has a service to await on the very first
  // navigation. Mounting installs the router plugin (via `createAppInstance`)
  // and kicks off that first navigation; if the service were created later —
  // as it was, in App.vue's `onBeforeMount` — the first guard run would find
  // none, skip the gate, and resolve the route on unknown auth state (the
  // "works only after a reload" bug). It's a synchronous constructor; the
  // Firebase init it fronts still happens lazily in `initAuth`. Cypress
  // component tests load `plugins.js` directly and never call `mountApp`, so
  // the guard's defensive try/catch still covers that path.
  createAuthService({
    projectId: import.meta.env.VITE_FIREBASE_ADMIN_PROJECT_ID,
    apiKey: import.meta.env.VITE_FIREBASE_ADMIN_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_ADMIN_AUTH_DOMAIN,
    emulatorAuthHost: import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_HOST || undefined,
  });

  const app = createAppInstance();
  app.mount('#app');
};
