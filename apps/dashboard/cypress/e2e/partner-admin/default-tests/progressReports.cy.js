const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

const testDistrictName = Cypress.env('testDistrictName');
const testDistrictId = Cypress.env('testDistrictId');
const testSchoolName = Cypress.env('testSchoolName');
const testSchoolId = Cypress.env('testSchoolId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

const openSchoolProgressReport = () => {
  cy.performRowAction(testDistrictName, 'card-administration__node-toggle-button');
  cy.performRowAction(testSchoolName, 'button-progress');
  cy.url().should('eq', `${baseUrl}/administration/${testPartnerAdministrationId}/school/${testSchoolId}`);
};

describe('Partner Admin: Progress Reports', () => {
  // @TODO: Expand on test to verify only stats exist for district admin.
  it('Renders only stats for district admin progress report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open district progress report.
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.performRowAction(testDistrictName, 'button-progress');
    cy.url().should('eq', `${baseUrl}/administration/${testPartnerAdministrationId}/district/${testDistrictId}`);

    // Validate that progress report table with individiual student data does not exist.
    cy.get('[data-cy="roar-data-table"]').should('not.exist');
  });

  it("Renders a school's progress report", () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open district progress report.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Expand desired district and open school progress report.
    openSchoolProgressReport();

    // Validate that all test users are present in the progress report.
    cy.checkUserList(testUserList);

    // Validate that all test assignments are present in the progress report.
    cy.findAllByTestId('column-header-content').then(($header) => {
      const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

      testAssignments.forEach((header) => {
        const headerIndex = tableHeaders.indexOf(header);

        if (headerIndex !== -1) {
          cy.get('[data-cy="roar-data-table"] tbody tr').each(($row) => {
            cy.wrap($row)
              .find('td')
              .eq(headerIndex)
              .then((headerCell) => {
                cy.wrap(headerCell).findByTestId('tag__root').should('exist');
              });
          });
        }
      });
    });
  });

  it('Exports the complete progress report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Expand desired district and open school progress report.
    openSchoolProgressReport();

    // Export the score report.
    cy.get('[data-cy="data-table__export-table-btn"]').contains('Export Whole Table').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-progress-partner-test-administration-cypress-test-school.csv`);
  });

  it('Exports a selected progress report', () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Expand desired district and open school progress report.
    openSchoolProgressReport();

    // Validate that the export button is disabled.
    cy.get('[data-cy="data-table__export-selected-btn"]').should('be.disabled');

    // Select a user to export.
    cy.findAllByTestId('row-checkbox__input').eq(1).click();
    cy.findAllByTestId('row-checkbox__input').eq(3).click();
    cy.findAllByTestId('row-checkbox__input').eq(5).click();

    // Export the score report.
    cy.get('[data-cy="data-table__export-selected-btn"]').contains('Export Selected').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-progress-selected.csv`);
  });
});
