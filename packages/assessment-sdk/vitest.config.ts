import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.integration.globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      enabled: false,
    },
  },
});
