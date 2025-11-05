const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

const testDistrictName = Cypress.env('testDistrictName');
const testDistrictId = Cypress.env('testDistrictId');
const testSchoolName = Cypress.env('testSchoolName');
const testSchoolId = Cypress.env('testSchoolId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');

const openSchoolScoreReport = () => {
  cy.performRowAction(testDistrictName, 'card-administration__node-toggle-button');
  cy.waitForScoreReportButton(testSchoolName);
  cy.performRowAction(testSchoolName, 'button-scores');
  cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/school/${testSchoolId}`);
};

describe('Partner Admin: Score Reports', () => {
  // @TODO: Expand on test to verify only stats exist for district admin.
  it('Renders only stats for district admin score report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open district score report.
    cy.getAdministrationCard(testPartnerAdministrationName);

    cy.waitForScoreReportButton(testDistrictName);

    cy.performRowAction(testDistrictName, 'button-scores');
    cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);

    // Validate that score report table with individual student data does not exist.
    cy.get('[data-cy="roar-data-table"]').should('not.exist');
  });

  it('Exports the complete score report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Wait for the score report button to load.
    cy.waitForScoreReportButton();

    // Open the score report.
    openSchoolScoreReport();

    // Export the score report.
    cy.get('[data-cy="data-table__export-table-btn"]').contains('Export All (CSV)').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-scores-partner-test-administration-cypress-test-school.csv`);
  });

  it('Exports a selected score report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Wait for the score report button to load.
    cy.waitForScoreReportButton();

    // Open the score report.
    openSchoolScoreReport();

    // Validate that the export button is disabled.
    cy.get('[data-cy="data-table__export-selected-btn"]').should('exist').should('be.disabled');

    // Select a user to export.
    cy.findAllByTestId('row-checkbox__input').eq(1).click();
    cy.findAllByTestId('row-checkbox__input').eq(3).click();
    cy.findAllByTestId('row-checkbox__input').eq(5).click();

    // Export the score report.
    cy.get('[data-cy="data-table__export-selected-btn"]').contains('Export Selected (CSV)').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-scores-selected-partner-test-administration-cypress-test-school.csv`);
  });
});
