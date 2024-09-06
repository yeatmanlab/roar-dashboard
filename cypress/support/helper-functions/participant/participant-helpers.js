export const timeout = Cypress.env('timeout');

export function signInWithClever() {
  cy.wait(0.2 * timeout);
  cy.get('button', { timeout: timeout }).contains('Clever').click();

  cy.origin(Cypress.env('cleverOAuthLink'), () => {
    cy.get('input[title="School name"]', { timeout: 60000 }).type(Cypress.env('cleverSchoolName'));
    cy.get('ul > li').contains(Cypress.env('cleverSchoolName')).click();
    // Find the username input field and input the username
    cy.get('input#username').type(Cypress.env('cleverUsername'));

    // Input password
    cy.get('input#password').type(Cypress.env('cleverPassword'));

    // Click the login button
    cy.get('button#UsernamePasswordForm--loginButton').click();
  });
}
