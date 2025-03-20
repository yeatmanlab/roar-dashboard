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

function launchExternalStudent() {
  cy.navigateTo('/launch/yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1');
  cy.wait(3 * timeout);
  cy.get('body', { timeout: 10 * timeout }).should('contain', 'external launch mode');
}

function returnToAdmin() {
  cy.get('button').contains('Return to administrator account').click();
  cy.get('body').should('contain', 'View Administrations');
}

describe('The partner admin can launch an external student.', () => {
  it('Selects an administration and launches a student into their tasks', () => {
    checkUrl();
    launchExternalStudent();
    returnToAdmin();
  });
});
