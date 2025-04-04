import { createApp } from 'vue';
import { Buffer } from 'buffer';
import { initSentry } from '@/sentry';
import PvTooltip from 'primevue/tooltip';
import App from '@/App.vue';
import AppSpinner from '@/components/AppSpinner.vue';
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

  // Register global components.
  app.component('AppSpinner', AppSpinner);

  // Register global directives.
  app.directive('tooltip', PvTooltip);

  // Register global variables.
  // eslint-disable-next-line no-undef
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
  const app = createAppInstance();
  app.mount('#app');
};
