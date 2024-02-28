describe('The partner admin can log in using a standard username and password.', () => {
  it('Logs the user in', () => {
    cy.login(Cypress.env('partnerAdminUsername'), Cypress.env('partnerAdminPassword'));
  });
});
