describe('Playing Video', () => {
  it('plays-video', () => {
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
    cy.visit('/');
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
    cy.get('.p-tablist-tab-list')
      .contains('ROAR - Word')
      .click();
    cy.get('.video-player-wrapper').click();
  });
});
