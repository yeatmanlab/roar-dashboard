const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({ timeout: 3 * timeout }).should('eq', `${baseUrl}/`);
}

function clickScoreButton() {
  cy.get('button', { timeout: timeout }).contains('Scores').first().click();
  cy.url({ timeout: 3 * timeout }).should(
    'eq',
    `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`,
  );
}

function checkAssignmentColumns() {
  cy.get('.p-datatable-column-header-content').then(($header) => {
    const tableHeaders = Array.from($header).map((header) => header.innerText);
    cy.log('Table Headers:', tableHeaders);

    testAssignments.forEach((assignment) => {
      expect(tableHeaders).to.include(assignment, `Expected header to include ${assignment}`);
    });
  });
}

describe('The partner admin can view score reports for a given administration.', () => {
  it('Selects an administration and views its score report.', () => {
    checkUrl();
    cy.wait(0.3 * timeout);
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.wait(0.3 * timeout);
    clickScoreButton();
    cy.wait(0.3 * timeout);
    cy.checkUserList(testUserList);
    cy.wait(0.3 * timeout);
    checkAssignmentColumns(testAssignments);
  });
});
