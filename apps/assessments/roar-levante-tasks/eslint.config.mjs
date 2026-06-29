import { config as base } from '@roar-platform/eslint-config';
import tseslint from 'typescript-eslint';
import cypress from 'eslint-plugin-cypress/flat';
import globals from 'globals';

export default [
  { ignores: ['serve/serve.js'] },
  ...base,

  // TypeScript files — parser and recommended rules
  ...tseslint.configs.recommended,

  // Global rule overrides — downgrade noisy rules that flag common patterns in legacy
  // LEVANTE JS/TS code. TODO: promote back to 'error' incrementally.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // TypeScript files — typed linting
  {
    files: ['src/**/*.ts', 'types/**/*.d.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Browser globals for assessment source and serve files
  {
    files: ['src/**/*.js', 'src/**/*.ts', 'serve/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
    },
  },

  // webpack.config.cjs — CommonJS Node.js
  {
    files: ['webpack.config.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },

  // Cypress test files
  cypress.configs.recommended,
  {
    files: ['cypress/**/*.cy.js', 'cypress/**/*.js', 'cypress.config.js', 'cypress/support/**/*.js'],
    plugins: { cypress },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'cypress/no-unnecessary-waiting': 'warn',
      'cypress/unsafe-to-chain-command': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
];
