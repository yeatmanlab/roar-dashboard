const timeout = Cypress.env('timeout');
describe('Playing Video', () => {
  it('plays-video', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
    cy.get('.p-tabview .p-tabview-nav li .p-tabview-nav-link', { timeout: 2 * timeout })
      .contains('ROAR - Word')
      .dblclick();
    cy.get('.vjs-big-play-button', { timeout: 2 * timeout }).click();
  });
});
