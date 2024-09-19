const testPartnerAdministration = Cypress.env('testPartnerAdministrationName');
const timeout = Cypress.env('timeout');
describe(
  'The admin user can navigate to the view administration page, ' + 'and can see search for an administration',
  () => {
    it('Activates the admin sidebar, then searches for an administration.', () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/');
      cy.wait(0.5 * timeout);
      cy.get("[data-cy='search-input']").type(`${testPartnerAdministration}{enter}`);
      cy.get('body').contains('You searched for');
      cy.get('[data-cy="h2-card-admin-title"]', { timeout: timeout }).contains(testPartnerAdministration);
    });
  },
);
