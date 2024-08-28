const timeout = Cypress.env('timeout');
describe('Playing Video', () => {
  it('plays-video', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
    cy.get('.tabview-nav-link-label', { timeout: 2 * timeout })
      .contains('ROAR - Word')
      .click();
    cy.get('.video-player-wrapper', { timeout: 2 * timeout }).click();
  });
});
