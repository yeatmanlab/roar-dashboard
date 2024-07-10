export const timeout = Cypress.env('timeout');

export function signInWithClever() {
  cy.wait(0.1 * timeout);
  cy.get('button').contains('Clever').click();

  cy.origin('https://clever.com/oauth/authorize', () => {
    cy.get('input[title="School name"]', { timeout: 10000 })
      .type('61e8aee84cf0e71b14295d45')
      .wait(1000)
      .type('{enter}');

    // Find the username input field and input the username
    cy.get('input#username').type('27988125011');

    // Input password
    cy.get('input#password').type('.EWKYDvAGNdGm!@g8a_E');

    // Click the login button
    cy.get('button#UsernamePasswordForm--loginButton').click();
  });
}
