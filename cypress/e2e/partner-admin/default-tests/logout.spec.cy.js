describe('The partner admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
    cy.visit('/', { timeout: Cypress.env('timeout') });
    cy.get('.admin-page-header').should('be.visible').and('contain', 'View Administrations');
    cy.logout();
  });
});
