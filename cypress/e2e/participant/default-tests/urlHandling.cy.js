describe('Participant: URL Handling', () => {
  it('Redirects to login when unauthenticated user visits home', () => {
    cy.visit('/');
    cy.wait(.2 *Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin`);
  });

  it('Redirects to login with redirect_to set to previous path when unauthenticated user visits a protected route', () => {
    // Randomized score and group values
    const randomizedUrl = '/scores/1xzvQB2LuEtOpRyMmsIRD/group/U0CJq53s79w8HShlOEDy';
    cy.visit(randomizedUrl);
    cy.wait(.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=${randomizedUrl}`);
  });

  it('Redirects to login with redirect_to=/unauthorized when unauthenticated user appends protocol prefixes', () => {
    cy.visit('/https://example.com');
    cy.wait(.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=/unauthorized`);
  });
})