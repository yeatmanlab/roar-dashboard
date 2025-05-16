// This test configuration imports required dependencies:
// - fileURLToPath: Converts file URLs to file paths
// - mergeConfig: Merges Vite configurations
// - defineConfig/coverageConfigDefaults: Vitest configuration utilities
// - viteConfig: Base Vite configuration to extend
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import viteConfig from './vite.config';

const isCI = process.env.CI === 'true';

export default mergeConfig(
  viteConfig,
  defineConfig({
    define: {
      'import.meta.env.VITE_LEVANTE': JSON.stringify('TRUE'),
    },
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
        include: ['src/**/*'],
        exclude: ['**/test-support/**', ...coverageConfigDefaults.exclude],
        all: true,
        clean: true,
        reporter: isCI ? ['json', 'json-summary', 'text-summary'] : ['html', 'text'],
      },
    },
  }),
);
