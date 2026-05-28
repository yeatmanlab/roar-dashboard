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
    files: ['**/*.test.ts', '**/*.integration.test.ts'],
    rules: {
      // toReturn() in route-test.helper.ts wraps expect() internally
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', '**.toReturn'] }],
    },
  },
];
