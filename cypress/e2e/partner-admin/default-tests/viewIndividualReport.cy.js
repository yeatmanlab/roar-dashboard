const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');

const baseUrl = Cypress.config().baseUrl;
const testUserList = Cypress.env('testUserList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url().should('eq', `${baseUrl}/`);
}

function clickScoreButton() {
  cy.get('button').contains('Scores').first().click();
  cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);
}

function checkIndividualScoreReport() {
  cy.get('[data-cy="route-button"]').first().click();
  cy.wait(0.3 * Cypress.env('timeout'));
  cy.get('body').should('contain', 'Individual Score Report');
  cy.get('button').contains('Expand All Sections').click();
  cy.get('button').contains('Export to PDF');
  cy.get('div').contains('The ROAR assessments return these kinds of scores');
}

describe('The partner admin can view individual score reports for a given administration.', () => {
  it("Selects an administration and views a student's individual score report", () => {
    checkUrl();
    cy.getAdministrationCard(testPartnerAdministrationName);
    clickScoreButton();
    cy.wait(0.3 * Cypress.env('timeout'));
    cy.checkUserList(testUserList);
    cy.wait(0.3 * Cypress.env('timeout'));
    checkIndividualScoreReport();
  });
});
