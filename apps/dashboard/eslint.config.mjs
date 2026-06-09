import { config as base } from '@roar-platform/eslint-config/vue';
import { fileURLToPath, URL } from 'url';

export default [
  ...base,
  // App-level override: ensure '@' resolves to this app's src regardless of CWD
  {
    files: ['**/*.{js,vue,mjs}'],
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', fileURLToPath(new URL('./src', import.meta.url))]],
          extensions: ['.js', '.mjs', '.vue', '.json'],
        },
      },
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: {
      // Disable no-conditional-expect: type guards checking response structure before assertions
      // are a legitimate pattern for type-safe response validation in TypeScript tests
      'vitest/no-conditional-expect': 'off',
    },
  },
];
