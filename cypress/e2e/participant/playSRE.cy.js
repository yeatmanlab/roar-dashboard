const timeout = Cypress.env("timeout");

describe('Test playthrough of SRE as a participant', () => {
  it('ROAR-Sentence Playthrough Test', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.get('.p-dropdown-trigger', { timeout: timeout }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: timeout })
      .contains(Cypress.env("testRoarAppsAdministration"))
      .should('be.visible')
      .click();

    cy.get('.p-tabview').contains('ROAR-Sentence');
    cy.visit(`/game/sre`);

    cy.get('.jspsych-btn', { timeout: 5 * timeout }).should('be.visible').click();

    cy.wait(0.2 * timeout);

    // cy.get('b').contains('I agree').click();
    // cy.get('.jspsych-btn', { timeout: 10000 }).should('be.visible').click();
    // cy.get('.jspsych-btn', { timeout: 10000 }).should('be.visible').click();

    // handles error where full screen throws a permissions error
    cy.wait(0.2 * timeout);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    cy.get('body', { timeout: 5 * timeout }).type('{enter}');
    cy.get('body', { timeout: 5 * timeout }).type('{1}');

    playSREGame();

    // check if game completed
    cy.get('.p-dropdown-trigger', { timeout: 5 * timeout }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: timeout }).contains(Cypress.env("testRoarAppsAdministration")).should('be.visible').click();
    cy.get('.tabview-nav-link-label').contains('ROAR-Sentence').should('have.attr', 'data-game-status', 'complete');
  });
});

function playSREGame() {
  // play tutorial
  for (let i = 0; i < 80; i++) {
    cy.log("loop 0", i)
    cy.wait(0.1 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.1 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
  }
}
