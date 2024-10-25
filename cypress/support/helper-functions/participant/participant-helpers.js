const timeout = Cypress.env('timeout');

export function signInWithClever() {
  cy.wait(0.2 * timeout);
  cy.get('button', { timeout: timeout }).contains('Clever').click();

  cy.origin(Cypress.env('cleverOAuthLink'), () => {
    const innerTimeout = Cypress.env('timeout');

    cy.get('input[title="School name"]', { timeout: 6 * innerTimeout }).type(Cypress.env('cleverSchoolName'));
    cy.get('ul > li', { timeout: innerTimeout }).contains(Cypress.env('cleverSchoolName')).click();
    // Find the username input field and input the username
    cy.get('input#username', { timeout: innerTimeout }).type(Cypress.env('cleverUsername'));
    cy.wait(0.2 * innerTimeout);

    // Input password
    cy.get('input#password', { timeout: innerTimeout }).type(Cypress.env('cleverPassword'));
    cy.wait(0.2 * innerTimeout);
    // Click the login button
    cy.get('button#UsernamePasswordForm--loginButton', { timeout: innerTimeout }).click();
  });
  cy.contains('tasks completed!', { timeout: 6 * timeout }).should('be.visible');
}
