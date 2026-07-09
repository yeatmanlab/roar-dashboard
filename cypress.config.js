// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "1rfg9a",
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:8000",
    experimentalRunAllSpecs: true,
    retries: 2,
    // eslint-disable-next-line no-unused-vars
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:8000",
      timeout: 10000,
    },
  },
});
