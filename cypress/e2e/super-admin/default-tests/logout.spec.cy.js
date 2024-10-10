describe('The super admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(cypress.env('SUPER_ADMIN_USERNAME'), cypress.env('SUPER_ADMIN_PASSWORD'));
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.logout();
  });
});
