import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration tests.
 *
 * Integration tests run against a real PostgreSQL database and require:
 * - TEST_CORE_DATABASE_URL or CORE_DATABASE_URL environment variable
 * - Database access with permission to run migrations
 *
 * Usage:
 *   npm run test:integration
 *   npx vitest run -c vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    watch: false,
    setupFiles: ['./vitest.integration.setup.ts'],
    include: ['**/*.integration.test.ts'],
    // Integration tests may be slower, allow more time
    testTimeout: 30000,
    hookTimeout: 60000,
    // Run integration tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      enabled: false, // Coverage is typically not needed for integration tests
    },
  },
});
