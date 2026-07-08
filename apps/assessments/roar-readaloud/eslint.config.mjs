import { config as base } from '@roar-platform/eslint-config';
import cypress from 'eslint-plugin-cypress/flat';
import globals from 'globals';

export default [
  ...base,

  // Generated / vendored assets that shouldn't be linted.
  {
    ignores: ['dist/**', 'lib/**', 'node_modules/**', 'src/**/*.onnx', '**/*.wasm'],
  },

  // Browser + Web Worker globals for assessment source and serve files.
  // The gaze-estimation worker (onnxruntime-web) runs off the main thread, so
  // worker globals (self, postMessage, importScripts) are needed alongside browser ones.
  {
    files: ['src/**/*.js', 'serve/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        process: 'readonly',
      },
    },
    rules: {
      // Rest-sibling destructuring (e.g. `const { a, b, ...rest } = obj`) is an
      // intentional omit pattern; the named bindings exist to exclude them from rest.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
      // Static assets (SVG stimuli, MP4 videos, ONNX model, WASM, CSV corpora) are
      // resolved by the bundler, not Node — ESLint's import resolver can't follow them.
      'import/no-unresolved': [
        'error',
        { ignore: ['\\.(svg|mp4|mp3|wav|png|jpe?g|gif|webp|onnx|wasm|csv|html|s?css)$'] },
      ],
    },
  },

  // Legacy eyetracking / calibration views rely on cross-file implicit globals
  // (a variable declared in one view and referenced as a window global in others).
  // Refactoring these gaze/video hot paths to explicit imports/exports is deferred to
  // avoid behavior changes during migration — tracked as tech debt. Scope the relaxation
  // to these files so `no-undef` stays active across the rest of the package.
  {
    files: ['src/experiment/views/**/*.js'],
    rules: {
      'no-undef': 'off',
      // Same legacy-views tech-debt scope: these fire pervasively on the untouched
      // eyetracking/calibration code and are deferred rather than refactored in PR1.
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-async-promise-executor': 'off',
      'no-prototype-builtins': 'off',
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
