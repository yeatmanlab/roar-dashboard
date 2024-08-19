const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.get('button').contains('Score').first().click();

    // make a selection
    cy.get('input.p-checkbox-input').first().click();

    cy.get('button').contains('Export Selected').click();
    cy.readFile(
      `${Cypress.env('cypressDownloads')}/roar-scores-partner-test-administration-cypress-test-district-selected.csv`,
    );
  });
});
