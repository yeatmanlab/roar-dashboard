// ***********************************************************
// This example support/component.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import { router } from '../../src/router/index.js';
import VueGoogleMaps from 'vue-google-maps-community-fork';
import TextClamp from 'vue3-text-clamp';
import { i18n } from '../../src/translations/i18n.js';
import { createPinia, setActivePinia } from 'pinia';
import { createHead } from '@unhead/vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createAppInstance } from '../../src/setup.js';
import { mount } from 'cypress/vue';
import plugins from '../../src/plugins.js';

import 'primevue/resources/primevue.css'; // primevue css
import 'primeicons/primeicons.css'; // icons
import 'primeflex/primeflex.scss'; // primeflex
import '../../src/assets/styles/theme-tailwind.css'; // base theme (pulled from Primevue)
import '../../src/assets/styles/theme.scss';
import { useAuthStore } from '../../src/store/auth.js'; // ROAR theme

Cypress.Commands.add('mount', (component, options = {}) => {
  const app = createAppInstance();

  cy.createMockStore();

  // Declare the app plugins and components for the Cypress context
  options.global = options.global || {};
  options.global.plugins = options.global.plugins || [];
  options.global.components = options.global.components || {};

  // // Add the router to the Cypress context
  // options.global.plugins.push(router);

  // Add plugins from the Vue app to the Cypress context
  plugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      options.global.plugins.push(...plugin);
    } else {
      options.global.plugins.push(plugin);
    }
  });

  // Copy the necessary Vue app global components to the Cypress context
  options.global.plugins.push({
    install(appInstance) {
      appInstance._context.components = app._context.components;
      // appInstance._context.directives = app._context.directives;
      // appInstance._context.provides = app._context.provides;
    },
  });

  return mount(component, options);
});
