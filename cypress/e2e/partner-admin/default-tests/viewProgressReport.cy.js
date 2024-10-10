const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testAdministrationId = Cypress.env('testAdministrationId');

const baseUrl = Cypress.config('baseUrl');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testUserList = Cypress.env('testUserList');
const testAssignments = Cypress.env('testAssignmentsList');

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url().should('eq', `${baseUrl}/`);
}

function clickProgressButton() {
  cy.get('button').contains('Progress').first().click();
  cy.url().should('eq', `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`);
}

function checkProgressTags(headers) {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    headers.forEach((header) => {
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
}

describe('The partner admin can view progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    checkUrl();
    cy.wait(0.3 * Cypress.env('timeout'));
    cy.getAdministrationCard(testPartnerAdministrationName);
    cy.wait(0.3 * Cypress.env('timeout'));
    clickProgressButton();
    cy.wait(0.3 * Cypress.env('timeout'));
    cy.checkUserList(testUserList);
    cy.wait(0.3 * Cypress.env('timeout'));
    checkProgressTags(testAssignments);
  });
});
