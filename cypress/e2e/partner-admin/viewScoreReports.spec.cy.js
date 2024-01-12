const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testAdministrationId = Cypress.env('testAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testUserList = Cypress.env('testUserList');
const testAssignments = ['vocab', 'Multichoice', 'cva'];

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({timeout: timeout}).should('eq', `${baseUrl}/`);
}

function checkAdministrationCardTitle() {
  cy.get('[data-cy="h2-card-admin-title"]', {timeout: timeout})
    .should('contain', testPartnerAdministrationName);
}

function clickScoreButton() {
  cy.get('button', {timeout: timeout}).contains("Show details").click();
    cy.get('button', {timeout: timeout}).contains("Scores").first().click();
    cy.url({timeout: timeout})
        .should('eq', `${baseUrl}/scores/${testAdministrationId}/district/${testDistrictId}`);
}

function checkAssignmentColumns() {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    testAssignments.forEach(assignment => {
      expect(tableHeaders).to.include(assignment);
    });
  });
}

describe('The partner admin can view score reports for a given administration.', () => {
  it('Selects an administration and views its score report.', () => {
    checkUrl()
    checkAdministrationCardTitle()
    clickScoreButton()
    cy.checkUserList(testUserList)
    checkAssignmentColumns(testAssignments)
  })
})