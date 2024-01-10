describe('Cypress test to login and logout', () => {
  it('passes', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/')

    cy.get('button', {timeout: 10000}).contains('Sign Out').click();

    // successfully back at Login page
    cy.contains('Welcome to ROAR!');
  });
});
