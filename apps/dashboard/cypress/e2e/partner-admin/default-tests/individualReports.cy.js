const baseUrl = Cypress.config().baseUrl;
const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testUserList = Cypress.env('testUserList');

describe('Partner Admin: Individual Reports', () => {
  it("Selects an administration and views a student's individual score report", () => {
    // Login as a partner admin.
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Wait for the score report button to load.
    cy.waitForScoreReportButton();

    // Open the score report.
    cy.get('button').contains('Scores').first().click();
    cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);

    // Ensure the score report is loaded.
    cy.waitForRoarTable({ tableSelector: '[data-cy="score-report__data-table"]' });

    // Validate that all test users are present in the progress report.
    cy.checkUserList(testUserList, { tableSelector: '[data-cy="score-report__data-table"]' });

    // Validate the individual score report.
    // @TODO: Change to populated test account to actually validate score report contents.
    cy.get('[data-cy="data-table__entry-details-btn"]').first().click();
    cy.get('[data-cy="report__header"] h1').should('contain', 'Individual Score Report');
    cy.get('[data-cy="report__expand-btn"]').contains('Expand All Sections').click();
    cy.get('[data-cy="report__pdf-export-btn"]').contains('Export to PDF');
  });
});
