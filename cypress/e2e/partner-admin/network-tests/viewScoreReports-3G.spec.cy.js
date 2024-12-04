const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const baseUrl = Cypress.config().baseUrl;
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url().should('eq', `${baseUrl}/`);
}

function clickScoreButton() {
  cy.get('button').contains('Scores').first().click();
  cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);
}

function checkAssignmentColumns() {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    testAssignments.forEach((assignment) => {
      expect(tableHeaders).to.include(assignment);
    });
  });
}

describe('The partner admin can view score reports for a given administration.', () => {
  it('Selects an administration and views its score report.', () => {
    checkUrl();
    cy.wait(Cypress.env('timeout'));
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.wait(Cypress.env('timeout'));
    clickScoreButton();
    cy.wait(Cypress.env('timeout'));
    cy.checkUserList(testUserList);
    cy.wait(timeout);
    checkAssignmentColumns(testAssignments);
  });
});
