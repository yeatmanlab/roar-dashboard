import { config as base } from '@roar-platform/eslint-config';
import globals from 'globals';

export default [
  ...base,

  // Generated / vendored assets that shouldn't be linted.
  {
    ignores: ['dist/**', 'lib/**', 'node_modules/**', 'src/**/*.onnx', '**/*.wasm'],
  },

  // Browser + Web Worker globals for assessment source and the serve harness. The
  // gaze-estimation worker (onnxruntime-web) runs off the main thread, so worker globals
  // are needed alongside browser ones. `ROAR_API_BASE_URL` is defined by webpack/rollup.
  {
    files: ['src/**/*.js', 'serve/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        process: 'readonly',
        ROAR_API_BASE_URL: 'readonly',
      },
    },
    rules: {
      // Rest-sibling destructuring (e.g. `const { a, b, ...rest } = obj`) is an
      // intentional omit pattern; the named bindings exist to exclude them from rest.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
      // Static assets (SVG stimuli, videos, ONNX model, WASM, CSV corpora) are
      // resolved by the bundler, not Node — ESLint's import resolver can't follow them.
      'import/no-unresolved': [
        'error',
        { ignore: ['\\.(svg|mp4|mp3|wav|png|jpe?g|gif|webp|onnx|wasm|csv|html|s?css)$'] },
      ],
    },
  },

  // The migrated experiment code is raw legacy source carried in verbatim, with pre-existing
  // debt (unused imports/vars, an empty block, and a dead barrel re-export of a never-added
  // trialHelpers.js). Per the migration boundary we don't edit the assessment author's code,
  // so these are downgraded to warnings — surfaced for cleanup, not blocking CI. The rollup
  // build is the real gate for genuinely unresolved imports.
  {
    files: ['src/experiment/**/*.js'],
    rules: {
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'import/no-unresolved': 'warn',
      'import/no-duplicates': 'warn',
    },
  },

  // Legacy eyetracking / calibration views rely on cross-file implicit globals
  // (a variable declared in one view and referenced as a window global in others).
  // Refactoring these gaze/video hot paths to explicit imports/exports is deferred to
  // avoid behavior changes during migration — tracked as tech debt.
  {
    files: ['src/experiment/tasks/**/views/**/*.js'],
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-async-promise-executor': 'off',
      'no-prototype-builtins': 'off',
    },
  },
];
