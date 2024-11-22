const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.get('button').contains('Score').first().click();

    cy.get('button').contains('Export Whole Table').click();
    cy.readFile(`${Cypress.env('cypressDownloads')}/roar-scores-partner-test-administration-cypress-test-district.csv`);
  });
});
