const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testAdministrationId = Cypress.env('testAdministrationId');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

const openProgressReport = () => {
  cy.get('button').contains('Progress').first().click();
  cy.url().should('eq', `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`);
};

describe('Partner Admin: Progress Reports', () => {
  it("Renders an administration's progress report", () => {
    // Login as a partner admin.
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Open the progress report.
    openProgressReport();

    // Validate that all test users are present in the progress report.
    cy.checkUserList(testUserList);

    // Validate that all test assignments are present in the progress report.
    cy.get('.p-datatable-column-header-content').then(($header) => {
      const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

      testAssignments.forEach((header) => {
        const headerIndex = tableHeaders.indexOf(header);

        if (headerIndex !== -1) {
          cy.get('[data-cy="roar-data-table"] tbody tr').each(($row) => {
            cy.wrap($row)
              .find('td')
              .eq(headerIndex)
              .then((headerCell) => {
                cy.wrap(headerCell).find('span.p-tag.p-component').should('exist');
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

    // Open the score report.
    openProgressReport();

    // Export the score report.
    cy.get('[data-cy="data-table__export-table-btn"]').contains('Export Whole Table').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-progress-partner-test-administration-cypress-test-district.csv`);
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

    // Open the score report.
    openProgressReport();

    // Validate that the export button is disabled.
    cy.get('[data-cy="data-table__export-selected-btn"]').should('be.disabled');

    // Select a user to export.
    cy.get('.p-checkbox-input').eq(1).click();
    cy.get('.p-checkbox-input').eq(3).click();
    cy.get('.p-checkbox-input').eq(5).click();

    // Export the score report.
    cy.get('[data-cy="data-table__export-selected-btn"]').contains('Export Selected').click();

    // Validate that the exported file exists.
    // @TODO: Extend to validate contents of the file.
    cy.readFile(`cypress/downloads/roar-progress-selected.csv`);
  });
});
