import { config as base } from '@roar-platform/eslint-config';
import globals from 'globals';

export default [
  ...base,

  // Generated / vendored assets that shouldn't be linted.
  {
    ignores: ['dist/**', 'lib/**', 'node_modules/**'],
  },

  // Browser globals for assessment source and the serve harness.
  {
    files: ['src/**/*.js', 'serve/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly',
        ROAR_DB: 'readonly',
        ROAR_API_BASE_URL: 'readonly',
      },
    },
    // Upstream carries airbnb-era eslint-disable comments for rules the monorepo config
    // doesn't enable; suppress the "unused directive" reports rather than editing the legacy
    // source, which keeps the migrated tree byte-identical to upstream for a clean PR #17 apply.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Rest-sibling destructuring (e.g. `const { a, b, ...rest } = obj`) is an intentional
      // omit pattern; `_`-named vars/args and empty `catch (_)`/`catch (e)` blocks are legacy
      // throwaways. None of these are refactored during the behavior-preserving migration.
      'no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Static assets (SVG stimuli, audio, CSV corpora, SCSS) are resolved by the bundler,
      // not Node — ESLint's import resolver can't follow them.
      'import/no-unresolved': ['error', { ignore: ['\\.(svg|mp4|mp3|wav|png|jpe?g|gif|webp|csv|json|s?css)$'] }],
    },
  },
];
