import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@bdelab/roar-utils': path.resolve(__dirname, 'node_modules/@bdelab/roar-utils/lib/index.js'),
    },
  },
  test: {
    environment: 'node',
  },
});
