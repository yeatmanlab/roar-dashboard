export const timeout = Cypress.env('timeout');

// userId in gse-roar-admin: NZouDdq6ZwYNyFdCbnuclw2fLJ82
// userId in gse-roar-admin-dev: O75V6IcVeiTwW8TRjXb76uydlwV2

describe('Test to maintain that assent form shows in when signing in with an un-assented user', () => {
  it('passes', () => {
    // this is a user that has an assignment of roarVocab -- how can we create a user that can
    // ALWAYS play the game
    let test_login = 'testlegaldoc@test.com';
    let test_pw = 'passwordLEGAL';
    // how can we write some logic to reset the already played
    cy.login(test_login, test_pw);
    cy.visit('/');
    cy.get('.p-dialog-title', { timeout: timeout }).contains('CONSENT').should('be.visible');
    cy.get('.p-confirm-dialog-accept').contains('Continue').should('be.visible');
  });
});
