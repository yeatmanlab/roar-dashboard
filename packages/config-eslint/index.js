import js from '@eslint/js';
import turboPlugin from "eslint-plugin-turbo";
import prettierPlugin from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

export const config = [
  // Base recommended JS rules
  js.configs.recommended,

  // Turbo rules
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // Shared general rules
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {},
    },
    rules: {
      'import/prefer-default-export': 'off',
      'import/no-cycle': 'off',
      'no-restricted-syntax': 'off',
      'camelcase': 'off',
      'func-names': 'off',
      'object-shorthand': 'off',
      'implicit-arrow-linebreak': 'off',
    },
  },

  // Test files (Vitest)
  {
    files: [
      '**/*.test.{js,ts}',
    ],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...vitest.environments.env.globals
      }
    }
  },

  // Prettier override
  prettierPlugin,

  // Ignored files
  {
    ignores: ['**/node_modules/**', '**/dist/**'],
  },
];