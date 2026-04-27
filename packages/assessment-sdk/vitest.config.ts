import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // @ts-expect-error Vitest supports projects but TS types lag behind
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
      ...(process.env.RUN_INTEGRATION_TESTS === 'true'
        ? [
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
          ]
        : []),
    ],
    coverage: {
      enabled: false,
    },
  },
});
