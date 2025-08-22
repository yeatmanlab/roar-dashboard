describe('The super admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(Cypress.env('SUPER_ADMIN_USERNAME'), Cypress.env('SUPER_ADMIN_PASSWORD'));
  });
});
