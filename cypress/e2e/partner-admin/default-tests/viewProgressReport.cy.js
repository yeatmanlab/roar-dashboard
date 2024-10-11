const baseUrl = Cypress.config().baseUrl;

const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testAdministrationId = Cypress.env('testAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

describe('Partner Admin: Progress Reports', () => {
  it('Selects an administration and views its progress report', () => {
    // Login as a partner admin.
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.visit('/');
    cy.url().should('eq', `${baseUrl}/`);

    // Wait until the administrations list is loaded.
    // Note: As the application currently does not support paginated fetching of administrations, we have to wait for
    // the whole list to be loaded and that can take a while, hence the long timeout.
    cy.waitForAdministrationsList();

    // Select the test administration and open the details page.
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Open the progress report.
    cy.get('button').contains('Progress').first().click();
    cy.url().should('eq', `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`);

    // Validate that all test users are present in the progress report.
    cy.checkUserList(testUserList);

    // Validate that all test assignments are present in the progress report.
    cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
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
});
