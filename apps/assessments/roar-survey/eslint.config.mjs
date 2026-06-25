import { config as base } from '@roar-platform/eslint-config/vue';

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
];
