describe('The partner admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(Cypress.env('PARTNER_ADMIN_USERNAME'), Cypress.env('PARTNER_ADMIN_PASSWORD'));
  });
});
