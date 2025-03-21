const roarDemoAdministrationName = Cypress.env('testPartnerAdministrationName');
describe(
  'The admin user can navigate to the view administration page, ' + 'and can see search for an administration',
  () => {
    it('Activates the admin sidebar, then searches for an administration.', () => {
      cy.login(Cypress.env('SUPER_ADMIN_USERNAME'), Cypress.env('SUPER_ADMIN_PASSWORD'));
      cy.navigateTo('/');
      cy.get("[data-cy='search-input']").type(`${roarDemoAdministrationName}{enter}`);
      cy.get('body').contains('You searched for');
      cy.get('[data-cy="h2-card-admin-title"]').contains(roarDemoAdministrationName);
    });
  },
);
