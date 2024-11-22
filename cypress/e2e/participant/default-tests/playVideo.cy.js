const timeout = Cypress.env('timeout');
describe('Playing Video', () => {
  it('plays-video', () => {
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
    cy.get('.p-tablist-tab-list', { timeout: 2 * timeout })
      .contains('ROAR - Word')
      .click();
    cy.get('.video-player-wrapper', { timeout: 2 * timeout }).click();
  });
});
