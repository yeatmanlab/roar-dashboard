describe('The super admin can log in using a standard username and password.', () => {
  it('passes', () => {
    const username = Cypress.env('superAdminUsername');
    const password = Cypress.env('superAdminPassword');

    cy.login(username, password);
  });
});
