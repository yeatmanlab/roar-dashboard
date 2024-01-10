describe('Test playthrough of SRE as a participant', () => {
  it('ROAR-Sentence Playthrough Test', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.get('.p-dropdown-trigger', { timeout: 10000 }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: 10000 })
      .contains('ZZZ Test Cypress Play Keypress Games')
      .should('be.visible')
      .click();

    cy.get('.p-tabview').contains('ROAR-Sentence');
    cy.visit(`/game/sre`);

    cy.get('.jspsych-btn', { timeout: 60000 }).should('be.visible').click();

    cy.wait(500);

    cy.get('b').contains('I agree').click();
    cy.get('.jspsych-btn', { timeout: 10000 }).should('be.visible').click();
    cy.get('.jspsych-btn', { timeout: 10000 }).should('be.visible').click();

    // handles error where full screen throws a permissions error
    cy.wait(500);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    playSREGame();
    // check if game completed
    cy.get('.p-dropdown-trigger', { timeout: 50000 }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: 10000 }).contains('ZZZ Test Shortened SRE').should('be.visible').click();
    cy.get('.tabview-nav-link-label').contains('ROAR-Sentence').should('have.attr', 'data-game-status', 'complete');
  });
});

function playSREGame() {
  // play tutorial
  for (let i = 0; i < 4; i++) {
    cy.wait(1000);
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(1000);
    cy.get('body').type('{leftarrow}{rightarrow}');
  }

  // continue twice
  cy.get('body').type('{leftarrow}');
  cy.get('body').type('{leftarrow}');

  for (let i = 0; i < 7; i++) {
    assert(cy.get('.stimulus').should('be.visible'));
    cy.get('body').type('{leftarrow}');
    cy.wait(10000);
    cy.get('.stimulus').should('be.visible');
    cy.get('body').type('{rightarrow}');
    cy.wait(10000);
  }

  cy.wait(1000);
  cy.get('body').type('{rightarrow}');
  cy.wait(40000);
  cy.get('body').type('{rightarrow}');
  assert(cy.contains('You are halfway through'));
  cy.get('body').type('{rightarrow}');

  for (let i = 0; i < 7; i++) {
    cy.get('.stimulus').should('be.visible');
    cy.get('body').type('{leftarrow}');
    cy.wait(10000);
    cy.get('.stimulus').should('be.visible');
    cy.get('body').type('{rightarrow}');
    cy.wait(10000);
  }

  cy.wait(1000);
  cy.get('body').type('{rightarrow}');
  cy.wait(40000);
  cy.get('body').type('{rightarrow}{leftarrow}');
  cy.wait(1000);
  assert(cy.contains('Amazing job!'));
  cy.wait(1000);
  cy.get('body').type('{rightarrow}{leftarrow}');
}
