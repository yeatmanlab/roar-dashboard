import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return config;
    },
    supportFile: false,
    env: {
      E2E_BASE_URL: process.env.E2E_BASE_URL,
      E2E_TEST_EMAIL: process.env.E2E_TEST_EMAIL,
      E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD,
    },
  },
});
