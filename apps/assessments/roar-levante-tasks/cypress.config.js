import { defineConfig } from 'cypress';
// @TODO: dotenv, cypressFsPlugin, env credentials
export default defineConfig({
  projectId: 'ugvgit',
  e2e: {
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? 'http://localhost:8000',
      timeout: 10000,
    },
  },
});
