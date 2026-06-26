import { config as base } from '@roar-platform/eslint-config/vue';
import cypress from 'eslint-plugin-cypress/flat';

export default [
  ...base,

  // Ignore build artifacts not covered by the shared config's ignores
  {
    ignores: ['**/lib/**'],
  },

  // Assessment-specific globals for SPA entry and Vue component files
  {
    files: ['src/**/*.js', 'src/**/*.vue'],
    languageOptions: {
      globals: {
        ROAR_API_BASE_URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  // Cypress test files
  cypress.configs.recommended,
  {
    files: ['cypress/**/*.cy.js', 'cypress/**/*.js'],
    plugins: { cypress },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'cypress/no-unnecessary-waiting': 'warn',
      'cypress/unsafe-to-chain-command': 'warn',
    },
  },

  // Cypress config file
  {
    files: ['cypress.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
