describe('The partner admin can log out.', () => {
  it('Logs the user out', () => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
    cy.visit('/');
    cy.logout();
  });
});
