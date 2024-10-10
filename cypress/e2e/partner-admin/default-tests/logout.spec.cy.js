describe('The partner admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(cypress.env('PARTNER_ADMIN_USERNAME'), cypress.env('PARTNER_ADMIN_PASSWORD'));
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.logout();
  });
});
