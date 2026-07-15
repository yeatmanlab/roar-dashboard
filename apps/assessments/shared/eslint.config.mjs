import { config as base } from '@roar-platform/eslint-config';
import globals from 'globals';

export default [
  ...base,

  // Browser globals for the shared assessment helpers and their unit tests. Unlike the
  // per-assessment serve.js files, nothing here reads the ROAR_DB / ROAR_API_BASE_URL
  // build-time constants, so they are intentionally not declared.
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly',
      },
    },
  },
];
