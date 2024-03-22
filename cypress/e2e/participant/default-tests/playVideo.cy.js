const timeout = Cypress.env('timeout');
describe('Playing Video', () => {
  it('passes', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
  });
});
