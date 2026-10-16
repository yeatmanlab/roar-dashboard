import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Separate from vite.config.js: that config is a mode-driven factory (lib / staging /
// production / development) and adding a `test` block to it would tie the suite to whichever
// mode happened to be active.
export default defineConfig({
  plugins: [vue()],
  test: {
    // SurveyRunner mounts real DOM and drives survey-core, so `node` is not sufficient.
    // happy-dom matches the dashboard, which is the only other Vue-testing workspace.
    environment: 'happy-dom',
  },
});
