import { config } from '@roar-platform/eslint-config/backend';

export default [
  ...config,
  {
    files: ['**/src/**/*.ts'],
    rules: {
      // Enforce using logger instead of console
      'no-console': 'error',
    },
  },
  {
    // Seeds run outside the main TypeScript project (tsconfig.json only covers src/).
    // The import resolver can't find workspace packages for these files, but resolution
    // works correctly at runtime via ts-node.
    files: ['**/seeds/**/*.ts'],
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.integration.test.ts'],
    rules: {
      // toReturn() in route-test.helper.ts wraps expect() internally
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', '**.toReturn'] }],
    },
  },
];
