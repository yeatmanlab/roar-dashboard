export const timeout = Cypress.env('timeout');

describe('Test to maintain that assent form shows in when signing in with an un-assented user', () => {
  it('passes', () => {
    // this is a user that has an assignment of roarVocab -- how can we create a user that can
    // ALWAYS play the game
    let test_login = 'DO_NOT_ACCEPT_DOC';
    let test_pw = 'passwordLEGAL';
    // how can we write some logic to reset the already played
    cy.login(test_login, test_pw);
    cy.visit('/');
    cy.wait(1000);
    cy.get('.p-dialog-title', { timeout: timeout }).contains('CONSENT FORM').should('be.visible');
    cy.get('.p-dialog-footer').contains('Continue').should('be.visible');
  });
});
