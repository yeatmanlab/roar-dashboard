const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard();
    cy.get('button').contains('Progress').first().click();

    cy.get('button').contains('Export Whole Table').click();
    cy.readFile(
      `${Cypress.env('cypressDownloads')}/roar-progress-zzz-cypress-test-administration-zzz-cypress-test-district.csv`,
    );
  });
});
