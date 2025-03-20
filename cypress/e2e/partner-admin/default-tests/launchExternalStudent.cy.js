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

function launchExternalStudent() {
  cy.get('[data-cy="route-button-launch"]', { timeout: 3 * timeout })
    .first()
    .click();
  cy.wait(3 * timeout);
  cy.get('body', { timeout: 10 * timeout }).should('contain', 'Currently in external launch mode');
}

describe('The partner admin can launch an external student.', () => {
  it('Selects an administration and launches a student into their tasks', () => {
    checkUrl();
    cy.getAdministrationCard(testPartnerAdministrationName);
    clickScoreButton();
    cy.wait(0.3 * timeout);
    cy.checkUserList(testUserList);
    cy.wait(0.3 * timeout);
    launchExternalStudent();
  });
});
