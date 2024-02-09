const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testUserList = Cypress.env('testUserList');
const testAssignments = ['vocab', 'Multichoice'];

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
    cy.getAdministrationCard();
    clickScoreButton();
    cy.checkUserList(testUserList);
    checkAssignmentColumns(testAssignments);
  });
});
