// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "cypress";

export default defineConfig({
  projectId: "p1ygx3",
  e2e: {
    experimentalRunAllSpecs: true,
    retries: 2,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:8000",
      timeout: 10000,
    },
  },
});
