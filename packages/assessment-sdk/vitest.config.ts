import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['src/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
          setupFiles: ['./vitest.setup.ts'],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          include: ['src/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          globalSetup: ['./vitest.integration.globalSetup.ts'],
          setupFiles: ['./vitest.setup.ts'],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
