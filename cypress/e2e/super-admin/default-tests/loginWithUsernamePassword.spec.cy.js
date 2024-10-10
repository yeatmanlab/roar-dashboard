describe('The super admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(cypress.env('SUPER_ADMIN_USERNAME'), cypress.env('SUPER_ADMIN_PASSWORD'));
  });
});
