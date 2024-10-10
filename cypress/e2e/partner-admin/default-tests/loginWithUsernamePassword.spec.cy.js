describe('The partner admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(cypress.env('PARTNER_ADMIN_USERNAME'), cypress.env('PARTNER_ADMIN_PASSWORD'));
  });
});
