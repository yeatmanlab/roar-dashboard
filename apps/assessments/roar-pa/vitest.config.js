import { defineConfig } from 'vitest/config';

// Unit tests for PA scoring logic. The experiment scoring code (scores.js) is pure
// JS that talks to store2 / papaparse / the schema — those are mocked in the tests,
// so a node environment is sufficient (no jsdom needed). Browser/E2E coverage lives
// in Cypress (*.cy.js), which this config intentionally does not pick up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    clearMocks: true,
  },
});
