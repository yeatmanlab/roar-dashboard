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
import { createPinia } from 'pinia';
import { createHead } from '@unhead/vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
//
// import RoarDataTable from '../../src/components/RoarDataTable.vue';
// import LanguageSelector from '../../src/components/LanguageSelector.vue';
//
// import { mount } from 'cypress/vue';
// import { h } from 'vue';
//
// Cypress.Commands.add('mount', (component, options = {}) => {
//   // Ensure the global option objects exist
//   options.global = options.global || {};
//   options.global.plugins = options.global.plugins || [];
//   options.global.components = options.global.components || {};
//
//   // Add the necessary plugins
//   options.global.plugins.push(PrimeVue);
//   options.global.plugins.push(ToastService);
//   options.global.plugins.push(ConfirmationService);
//   options.global.plugins.push(i18n);
//   options.global.plugins.push(VueQueryPlugin);
//   // options.global.plugins.push(VueRecaptchaPlugin);
//   options.global.plugins.push(VueGoogleMaps);
//   options.global.plugins.push(TextClamp);
//   options.global.plugins.push(createPinia());
//   options.global.plugins.push(createHead());
//
//   // Add the router separately
//   options.router = router;
//   options.global.plugins.push({
//     install(app) {
//       app.use(options.router);
//     },
//   });
//
//   // Register global components
//   options.global.components['RoarDataTable'] = RoarDataTable;
//   options.global.components['LanguageSelector'] = LanguageSelector;
//
//   // Log options for debugging purposes
//   cy.log(options);
//
//   // Mount the component with the options
//   return mount( () => {
//     return h(component, options);
//   })
// });

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
import PrimeVue from 'primevue/config';
import { initApp } from '../../src/main.js';
import { mount } from 'cypress/vue';
import PvButton from 'primevue/button';
import PvMenubar from 'primevue/menubar';

import 'primevue/resources/primevue.css'; // primevue css
import 'primeicons/primeicons.css'; // icons
import 'primeflex/primeflex.scss'; // primeflex
import '../../src/assets/styles/theme-tailwind.css'; // base theme (pulled from Primevue)
import '../../src/assets/styles/theme.scss'; // ROAR theme

initApp();
Cypress.Commands.add('mount', (component, options = {}) => {
  // options.global = options.global || {};
  // options.global.plugins = options.global.plugins || [];
  //
  // options.global.plugins.push(VueQueryPlugin);
  // options.global.plugins.push(PrimeVue, { ripple: true });
  //
  // options.global.components = options.global.components || {};
  // options.global.components['PvButton'] = PvButton;
  // options.global.components['MenuBar'] = PvMenubar;
  //
  // // Add the router separately
  // options.router = router;
  // options.global.plugins.push({
  //   install(app) {
  //     app.use(options.router);
  //   },
  // });

  return mount(component, options);
});
