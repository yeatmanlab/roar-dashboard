import { defineConfig } from 'vitest/config';

const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    watch: false,
    setupFiles: ['./vitest.setup.ts'],
    // Exclude integration tests - they have their own config (vitest.integration.config.ts)
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    coverage: {
      enabled: true,
      all: true,
      clean: true,
      provider: 'v8',
      reporter: isCI ? [['lcov', { projectRoot: '../..' }], 'json', 'json-summary', 'text-summary'] : ['html', 'text'],
    },
  },
});
