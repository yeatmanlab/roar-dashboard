import { config as base } from '@roar-dashboard/eslint-config';
import cypress from 'eslint-plugin-cypress/flat';
import globals from 'globals';

export default [
  ...base,

  // Browser globals for assessment source files
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly',
      },
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
      globals: {
        ...globals.node,
        __dirname: 'readonly',
      },
    },
  },
];
