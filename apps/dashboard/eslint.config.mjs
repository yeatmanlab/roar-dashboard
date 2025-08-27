import { config as base } from '@repo/eslint-config/vue';
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
];
