const testPartnerAdminUsername = cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = cypress.env('PARTNER_ADMIN_PASSWORD');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.get('button').contains('Progress').first().click();

    cy.get('button').contains('Export Whole Table').click();
    cy.readFile('cypress/downloads/roar-progress-partner-test-administration-cypress-test-district.csv');
  });
});
