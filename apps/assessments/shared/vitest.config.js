import { defineConfig } from 'vitest/config';

// Shared assessment helpers. variantPicker renders DOM, so a jsdom environment is
// required (matches roar-levante-tasks). Pure-node helpers here run fine under jsdom too.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['*.test.js'],
    clearMocks: true,
  },
});
