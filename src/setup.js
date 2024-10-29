import { createApp } from 'vue';
import { VueRecaptchaPlugin } from 'vue-recaptcha';
import { Buffer } from 'buffer';
import { initSentry } from '@/sentry';

import App from '@/App.vue';
import plugins from './plugins';

import PvTooltip from 'primevue/tooltip';

import './styles.css';

/**
 * Create a new Vue app instance with all the necessary plugins and components registered that can be used in the main
 * app or in Cypress component tests.
 *
 * @returns {App<Element>}
 */
export const createAppInstance = () => {
  const app = createApp(App);

  // Register all default app plugins
  plugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      app.use(...plugin);
    } else {
      app.use(plugin);
    }
  });

  // Not adding this to default plugins for now, it is causing issues with Cypress component tests
  app.use(VueRecaptchaPlugin, {
    v3SiteKey: '6Lc-LXsnAAAAAHGha6zgn0DIzgulf3TbGDhnZMAd',
  });

  app.directive('tooltip', PvTooltip);

  // Register all components that begin with App
  const appComponentFiles = import.meta.glob('./components/App*.vue', { eager: true });

  Object.entries(appComponentFiles).forEach(([path, m]) => {
    const componentName = path.split('/').pop().replace('.vue', '');
    app.component(componentName, m.default);
  });

  // eslint-disable-next-line no-undef
  globalThis.Buffer = Buffer;

  if (process.env.NODE_ENV === 'production') {
    initSentry(app);
  }

  return app;
};

/**
 * Initialize the main app instance and mount it to the DOM.
 * Do not call this function in Cypress tests as the testing environment mounts the app differently.
 * @returns {void}
 */
export const mountApp = () => {
  const app = createAppInstance();
  app.mount('#app');
};
