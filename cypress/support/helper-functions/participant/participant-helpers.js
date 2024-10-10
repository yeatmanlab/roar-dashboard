export function signInWithClever() {
  cy.wait(0.2 * Cypress.env('timeout'));
  cy.get('button').contains('Clever').click();

  cy.origin(Cypress.env('cleverOAuthLink'), () => {
    cy.get('input[title="School name"]').type(Cypress.env('cleverSchoolName'));
    cy.get('ul > li').contains(Cypress.env('cleverSchoolName')).click();
    // Find the username input field and input the username
    cy.get('input#username').type(Cypress.env('CLEVER_USERNAME'));
    cy.wait(0.2 * Cypress.env('timeout'));

    // Input password
    cy.get('input#password').type(Cypress.env('CLEVER_PASSWORD'));
    cy.wait(0.2 * Cypress.env('timeout'));
    // Click the login button
    cy.get('button#UsernamePasswordForm--loginButton').click();
  });
  cy.contains('tasks completed!').should('be.visible');
}
