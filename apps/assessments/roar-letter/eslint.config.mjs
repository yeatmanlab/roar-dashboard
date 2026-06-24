import { config as base } from '@roar-platform/eslint-config';
import cypress from 'eslint-plugin-cypress/flat';
import globals from 'globals';

export default [
  // serve/ uses the deleted standalone firebaseConfig and is pending a full
  // SDK-migration rewrite in the configure-letter PR. Exclude it until then.
  { ignores: ['serve/**'] },

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
    rules: {
      // Rest-sibling destructuring (e.g. `const { a, b, ...rest } = obj`) is an
      // intentional omit pattern; the named bindings exist to exclude them from rest.
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
      globals: {
        ...globals.node,
      },
    },
  },
];
