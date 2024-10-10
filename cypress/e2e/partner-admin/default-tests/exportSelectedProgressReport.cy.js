const testPartnerAdminUsername = cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = cypress.env('PARTNER_ADMIN_PASSWORD');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');

describe('The partner admin can select and export progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.navigateTo('/');
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.get('button').contains('Progress').first().click();

    // make a selection
    cy.get('.p-checkbox-box').first().click();

    cy.get('button').contains('Export Selected').click();
    cy.readFile('cypress/downloads/roar-progress-selected.csv');
  });
});
