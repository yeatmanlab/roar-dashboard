import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: process.env.CYPRESS_PROJECT_ID ?? undefined,
  e2e: {
    experimentalRunAllSpecs: true,
    retries: 2,
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8000',
      variantUrl: `${process.env.CYPRESS_BASE_URL || 'http://localhost:8000'}/?storyoption=grade-based&grade=6`,
      timeout: 10000,
    },
  },
});
