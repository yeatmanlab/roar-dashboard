const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testUserList = Cypress.env('testUserList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({ timeout: timeout }).should('eq', `${baseUrl}/`);
}

function clickScoreButton() {
  cy.get('button', { timeout: timeout }).contains('Scores').first().click();
  cy.url({ timeout: timeout }).should(
    'eq',
    `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`,
  );
}

function checkIndividualScoreReport() {
  cy.get('[data-cy="route-button"]', { timeout: 3 * timeout })
    .first()
    .click();
  cy.wait(0.3 * timeout);
  cy.get('body', { timeout: 3 * timeout }).should('contain', 'Individual Score Report');
  cy.get('button', { timeout: 3 * timeout })
    .contains('Expand All Sections')
    .click();
  cy.get('button', { timeout: 3 * timeout }).contains('Export to PDF');
  cy.get('div', { timeout: 3 * timeout }).contains('The ROAR assessments return these kinds of scores');
}

describe('The partner admin can view individual score reports for a given administration.', () => {
  it("Selects an administration and views a student's individual score report", () => {
    checkUrl();
    cy.getAdministrationCard(testPartnerAdministrationName);
    clickScoreButton();
    cy.wait(0.3 * timeout);
    cy.checkUserList(testUserList);
    cy.wait(0.3 * timeout);
    checkIndividualScoreReport();
  });
});
