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

const createMockStore = () => {
  setActivePinia(createPinia());
  const authStore = useAuthStore();

  authStore.$patch({
    firebaseUser: {
      adminFirebaseUser: {
        uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
        email: '123',
        isUserAuthedAdmin: true,
        isUserAuthedApp: true,
        isAuthenticated: true,
      },
      appFirebaseUser: {
        uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
        email: '123',
        isUserAuthedAdmin: true,
        isUserAuthedApp: true,
        isAuthenticated: true,
      },
    },
    roarfirekit: {
      initialized: true,
      restConfig: {
        admin: {
          // headers: { Authorization: `Bearer ${this._idTokens.admin}` },
          baseURL: `https://firestore.googleapis.com/v1/projects/gse-roar-admin-dev/databases/(default)/documents`,
        },
        app: {
          // headers: { Authorization: `Bearer ${this._idTokens.app}` },
          baseURL: `https://firestore.googleapis.com/v1/projects/gse-roar-assessment-dev/databases/(default)/documents`,
        },
      },
    },
    userData: {
      uid: 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1',
      email: '123',
      username: 'Test User',
      name: {
        first: 'Test',
        last: 'User',
      },
    },
  });
  console.log('mock store created', authStore);
  return authStore;
};

Cypress.Commands.add('setAuthStore', () => {
  const authStore = createMockStore();
  const serializedStore = JSON.stringify(authStore.$state);

  cy.window().then((window) => {
    window.sessionStorage.setItem('authStore', serializedStore);
  });

  cy.wrap(authStore.$state).as('authStore');
});

Cypress.Commands.add('mount', (component, options = {}) => {
  const app = createAppInstance();

  options.global = options.global || {};
  options.global.plugins = options.global.plugins || [];
  options.global.components = options.global.components || {};

  // Add the router to the Cypress context
  options.global.plugins.push(router);

  plugins.forEach((plugin) => {
    if (Array.isArray(plugin)) {
      options.global.plugins.push(...plugin);
    } else {
      options.global.plugins.push(plugin);
    }
  });

  options.global.plugins.push({
    install(appInstance) {
      appInstance.component = app.component;
      appInstance.directive = app.directive;
    },
  });

  // cy.wrap(createMockStore()).as('authStore');

  return mount(component, options);
});
