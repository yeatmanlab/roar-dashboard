describe('The super admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.logout();
  });
});
