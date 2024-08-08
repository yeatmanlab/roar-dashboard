import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

const isCI = process.env.CI === 'true';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      exclude: [...configDefaults.exclude],
      root: fileURLToPath(new URL('./', import.meta.url)),
      watch: false,
      setupFiles: ['./vitest.setup.js'],
      // coverage: {
      //   enabled: true,
      //   all: true,
      //   clean: true,
      //   reporter: isCI ? [
      //     ['lcov', { 'projectRoot': '../..' }],
      //     'json',
      //     'json-summary',
      //     'text-summary'
      //   ] :
      //   [
      //     'html',
      //     'text-summary'
      //   ]
      // }
    },
  }),
);
