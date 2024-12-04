const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

describe('Partner Admin: Auth', () => {
  it('Logs in as a partner admin', () => {
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    cy.get('[data-cy="user-display-name"]').should('contain', PARTNER_ADMIN_USERNAME);
  });

  it('Logs out', () => {
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);
    cy.logout();
  });
});
