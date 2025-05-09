import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import viteConfig from './vite.config';

const isCI = process.env.CI === 'true';

const viteConfigObject = viteConfig({ mode: process.env.NODE_ENV || 'test' });

export default mergeConfig(
  viteConfigObject,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      root: fileURLToPath(new URL('./', import.meta.url)),
      dir: 'src/',
      watch: false,
      setupFiles: ['./vitest.setup.js'],
      clearMocks: true,
      coverage: {
        enabled: true,
        provider: 'istanbul',
        include: ['src/**/*.js', '!src/**/*.test.js'],
        exclude: ['**/test-support/**', ...coverageConfigDefaults.exclude],
        all: true,
        clean: true,
        reporter: isCI ? ['json', 'json-summary', 'text-summary'] : ['html', 'text'],
      },
    },
  }),
);
