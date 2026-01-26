import { defineConfig } from 'vitest/config';

const isCI = process.env.CI === 'true';

/**
 * Vitest configuration for integration tests.
 *
 * This is a standalone config (not extending base vitest.config.ts) because:
 * - Base config excludes *.integration.test.ts files
 * - Base config uses vi.resetModules() which breaks DB client persistence
 * - Integration tests need different setup (globalSetup, longer timeouts)
 */
export default defineConfig({
  test: {
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
    coverage: {
      enabled: true,
      all: true,
      clean: true,
      provider: 'v8',
      reporter: isCI ? [['lcov', { projectRoot: '../..' }], 'json', 'json-summary', 'text-summary'] : ['html', 'text'],
    },
  },
});
