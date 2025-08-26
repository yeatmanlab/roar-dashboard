import js from '@eslint/js';
import importConfig from 'eslint-plugin-import';
import turboConfig from "eslint-config-turbo/flat";
import prettierConfig from 'eslint-config-prettier';
import vitest from '@vitest/eslint-plugin';
import globals from 'globals';

export const config = [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
    ],
  },

  // Base recommended JS rules
  js.configs.recommended,

  // Import rules
  importConfig.flatConfigs.recommended,

  // Turbo rules
  ...turboConfig,
  {
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },

  // Import resolution
  {
    files: ['**/*.{js,ts,mjs}'],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './tsconfig.json',
            './apps/*/tsconfig.json',
            './packages/*/tsconfig.json',
          ],
        },
        node: {
          extensions: ['.js', '.mjs', '.ts', '.d.ts', '.json'],
        },
      },
    }
  },

  // Shared general rules
  {
    files: ['**/*.{js,ts,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {},
    },
    rules: {
      'import/prefer-default-export': 'off',
      'import/no-named-as-default': 'off',
      'import/no-cycle': 'off',
      'no-restricted-syntax': 'off',
      'camelcase': 'off',
      'func-names': 'off',
      'object-shorthand': 'off',
      'implicit-arrow-linebreak': 'off',
    },
  },

  // Test file rules (Vitest)
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

  // Node tooling/config files (shared across frontend/backend)
  {
    files: [
      '**/*.{config,setup}.{js,cjs,mjs,ts}',
      '**/rollup.config.mjs',
      '**/drizzle*.{ts,js}',
      '**/vite.config.{js,ts}',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        process: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  // Prettier rules
  prettierConfig,
];