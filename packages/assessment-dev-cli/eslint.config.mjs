import { config as base } from '@roar-platform/eslint-config';
import globals from 'globals';

export default [
  ...base,

  // Plain Node ESM sources — no browser globals, no bundler.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // turbo/no-undeclared-env-vars guards cache correctness of build
      // outputs. This package has no build — it's a runtime CLI whose whole
      // job is reading the environment (ASSESSMENT_PG_PORT, npm_execpath, …),
      // so declaring them in turbo.json would only pollute the global cache key.
      'turbo/no-undeclared-env-vars': 'off',
    },
  },
];
