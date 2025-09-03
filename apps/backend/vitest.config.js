import { defineConfig } from 'vitest/config';

const isCI = process.env.CI === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    watch: false,
    coverage: {
      enabled: true,
      all: true,
      clean: true,
      provider: 'v8',
      reporter: isCI
        ? [['lcov', { projectRoot: '../..' }], 'json', 'json-summary', 'text-summary']
        : ['html', 'text-summary'],
    },
  },
});
