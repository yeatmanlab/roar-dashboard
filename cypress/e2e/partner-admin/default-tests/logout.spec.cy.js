describe('The partner admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.logout();
  });
});
