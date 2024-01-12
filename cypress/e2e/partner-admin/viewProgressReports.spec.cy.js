const testDistrictId = Cypress.env("testDistrictId");
const testAdministrationId = Cypress.env('testAdministrationId');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const testUserList = Cypress.env('testUserList');
const testAssignments = ['vocab', 'Multichoice', 'cva'];


function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({ timeout: timeout }).should('eq', `${baseUrl}/`);
}

function checkAdministrationCardTitle() {
  cy.get('[data-cy="h2-card-admin-title"]', { timeout: timeout }).should('contain', testPartnerAdministrationName);
}

function clickProgressButton() {
  cy.get('button', { timeout: timeout }).contains("Show details").click();
  cy.get('button', { timeout: timeout }).contains("Progress").first().click();
  cy.url({ timeout: timeout }).should(
    'eq',
    `${baseUrl}/administration/${testAdministrationId}/district/${testDistrictId}`,
  );
}

function checkProgressTags(headers) {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    headers.forEach(header => {
      const headerIndex = tableHeaders.indexOf(header);

      if (headerIndex !== -1) {
        cy.get('[data-cy="roar-data-table"] tbody tr').each(($row) => {
          cy.wrap($row).find('td').eq(headerIndex)
            .then((headerCell) => {
              cy.wrap(headerCell)
                .find('span.p-tag.p-component')
                .should('exist');
            });
        });
      }
    });
  });
}

describe('The partner admin can view progress reports for a given administration.', () => {
  it('Selects an administration and views its progress report', () => {
    checkUrl();
    checkAdministrationCardTitle()
    clickProgressButton();
    cy.checkUserList(testUserList)
    checkProgressTags(testAssignments);
  });
});
