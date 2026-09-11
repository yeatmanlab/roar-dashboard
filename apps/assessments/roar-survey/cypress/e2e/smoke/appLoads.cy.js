const BASE_URL = Cypress.env('baseUrl') ?? 'http://localhost:8000';

describe('Smoke: roar-survey app loads', () => {
  it('mounts the Vue app without a JS crash', () => {
    cy.visit(BASE_URL);
    // The app root is always present once Vue mounts, regardless of whether
    // the survey JSON loaded (GCS is not available in CI).
    cy.get('#app').should('exist');
  });
});
