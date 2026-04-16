import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    watch: false,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts', '**/node_modules/**'],
          globals: true,
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          globals: true,
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          globalSetup: ['./vitest.integration.globalSetup.ts'],
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
    coverage: {
      enabled: false,
    },
  },
} as any);
