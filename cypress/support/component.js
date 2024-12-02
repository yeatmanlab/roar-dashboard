import { mount } from 'cypress/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import { i18n } from '@/translations/i18n.js';
import { routes } from '@/router';

// Import global styles.
import '@/styles.css';

/**
 * Mount Command
 *
 * This command adds a custom cy.mount() command to mount Vue components for testing.
 *
 * As the existing codebase uses a certain set of plugins and component libraries, the following are loaded into the
 * Cypress test runner context to ensure compatibility:
 * - i18n: The internationalization plugin for resolving translations.
 * - PrimeVue: The PrimeVue plugin for using PrimeVue components.
 * - Vue Router: The Vue Router plugin for resolving in-component router links.
 *
 * Important: we do not load the complete set of plugins loaded by the main application, as components tests should test
 * components in isolation. We make an exception for the above plugins as those are tightly integrated with the
 * components. Before adding more plugins, consider whether they are truly necessary for testing the component in
 * isolation. If a component requires a plugin to function correctly, it may indicate a violation of the separation of
 * concerns principle and a refactoring would be beneficial.
 *
 * @param {VueComponent} component - The Vue component to mount.
 * @param {object} [options={}] - Optional configuration for mounting, including global plugins and components.
 * @returns {Cypress.Chainable} - The chainable Cypress object for further commands.
 */
Cypress.Commands.add('mount', (component, options = {}) => {
  options.global = options.global || {};
  options.global.plugins = options.global.plugins || [];

  // Load the i18n plugin to resolve in-component translations.
  options.global.plugins.push(i18n);

  // Load the PrimeVue plugin to enable the use of PrimeVue components.
  options.global.plugins.push(PrimeVue, { ripple: true });
  options.global.plugins.push(ConfirmationService);
  options.global.plugins.push(ToastService);

  // Load the Vue Router plugin to resolve in-component router links.
  // Important: Only create a new router if one is not already provided by the test itself.
  if (!options.router) {
    options.router = createRouter({
      routes,
      history: createMemoryHistory(),
    });
  }

  // Add router plugin
  options.global.plugins.push({
    install(app) {
      app.use(options.router);
    },
  });

  return mount(component, options);
});
