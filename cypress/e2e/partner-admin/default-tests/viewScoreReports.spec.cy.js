const baseUrl = Cypress.config().baseUrl;
const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

describe('Partner Admin: Score Reports', () => {
  it('Selects an administration and views its score report', () => {
    // Login as a partner admin.
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Open the score report.
    cy.get('button').contains('Scores').first().click();
    cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);

    // Validate that all test users are present in the progress report.
    cy.checkUserList(testUserList);

    // Validate that all test assignments are present in the score report.
    cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
      const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

      testAssignments.forEach((assignment) => {
        expect(tableHeaders).to.include(assignment);
      });
    });
  });
});
