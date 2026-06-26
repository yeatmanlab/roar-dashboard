import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_ID,
  e2e: {
    experimentalRunAllSpecs: true,
    retries: 2,
    setupNodeEvents() {
      // implement node event listeners here
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8000',
      timeout: 10000,
    },
  },
});
