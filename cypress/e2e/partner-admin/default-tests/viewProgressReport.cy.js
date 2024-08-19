const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testAdministrationId = Cypress.env('testAdministrationId');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({ timeout: 3 * timeout }).should('eq', `${baseUrl}/`);
}

function clickProgressButton() {
  cy.get('button', { timeout: timeout }).contains('Progress').first().click();
  cy.url({ timeout: 3 * timeout }).should(
    'eq',
    `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`,
  );
}

function checkProgressTags(headers) {
  cy.get('.p-datatable-column-header-content').then(($header) => {
    const tableHeaders = Array.from($header).map((elem) => elem.innerText.trim());
    cy.log('Table Headers:', tableHeaders);

    headers.forEach((header) => {
      const headerIndex = tableHeaders.indexOf(header);

      if (headerIndex !== -1) {
        cy.get('[data-cy="roar-data-table"] tbody tr', { timeout: timeout }).each(($row) => {
          cy.wrap($row)
            .find('td')
            .eq(headerIndex)
            .then((headerCell) => {
              cy.wrap(headerCell).find('span.p-tag.p-component').should('exist');
            });
        });
      } else {
        cy.log(`Header "${header}" not found in table headers.`);
      }
    });
  });
}

describe('The partner admin can view progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    checkUrl();
    cy.getAdministrationCard(testPartnerAdministrationName);
    clickProgressButton();
    cy.checkUserList(testUserList);
    checkProgressTags(testAssignments);
  });
});
