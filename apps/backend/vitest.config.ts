import { defineConfig } from 'vitest/config';

const isCI = process.env.CI === 'true';

const coverageConfig = {
  enabled: true,
  all: true,
  clean: true,
  provider: 'v8' as const,
  reporter: isCI
    ? ([['lcov', { projectRoot: '../..' }], 'json', 'json-summary', 'text-summary'] as const)
    : (['html', 'text'] as const),
};

export default defineConfig({
  test: {
    coverage: coverageConfig,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          watch: false,
          setupFiles: ['./vitest.setup.ts'],
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          watch: false,
          include: ['**/*.integration.test.ts'],
          exclude: ['**/node_modules/**'],
          globalSetup: ['./vitest.integration.globalSetup.ts'],
          setupFiles: ['./vitest.integration.setup.ts'],
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
  },
});
