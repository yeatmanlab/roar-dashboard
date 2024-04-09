const roarDemoAdministrationName = Cypress.env('testPartnerAdministrationName');

describe(
  'The admin user can navigate to the view administration page, ' + 'and can see search for an administration',
  () => {
    it('Activates the admin sidebar, then searches for an administration.', () => {
      cy.login(Cypress.env('superAdminUsername'), Cypress.env('superAdminPassword'));
      cy.navigateTo('/');
      cy.get("[data-cy='search-input'").click().type(roarDemoAdministrationName).type('{enter}');
      cy.get('body').contains('You searched for');
      cy.get('div').contains('Dates');
      cy.get('div').contains('Assessments');
    });
  },
);
