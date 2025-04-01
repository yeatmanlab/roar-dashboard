import { createApp, type App, type Plugin } from 'vue';
import { VueRecaptchaPlugin } from 'vue-recaptcha';
import { Buffer } from 'buffer';
import { initSentry } from './sentry';
import PvTooltip from 'primevue/tooltip';
import AppComponent from './App.vue';
import AppSpinner from './components/AppSpinner.vue';
import plugins from './plugins';
import './styles.css';

declare global {
  var Buffer: typeof Buffer;
}

type PluginWithOptions = [Plugin, Record<string, unknown>];
type AppPlugin = Plugin | PluginWithOptions;

/**
 * Create Vue App
 *
 * @returns {App<Element>}
 */
export const createAppInstance = (): App<Element> => {
  const app = createApp(AppComponent);

  // Register all app plugins.
  plugins.forEach((plugin: AppPlugin) => {
    if (Array.isArray(plugin)) {
      const [pluginInstance, options] = plugin as PluginWithOptions;
      app.use(pluginInstance, options);
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
export const mountApp = (): void => {
  const app = createAppInstance();
  app.mount('#app');
}; 