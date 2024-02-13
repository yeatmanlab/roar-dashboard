const roarDemoDistrictName = Cypress.env('roarDemoDistrictName');
const roarDemoDistrictId = Cypress.env('roarDemoDistrictId');
const roarDemoAdministrationName = Cypress.env('roarDemoAdministrationName');
const roarDemoAdministrationId = Cypress.env('roarDemoAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const headers = ['School']

function checkUrl() {
  cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
  cy.navigateTo('/');
  cy.url({ timeout: timeout }).should('eq', `${baseUrl}/`);
}

function clickScoreButton() {
  cy.get('button', { timeout: timeout }).contains('Scores').first().click();
  cy.url({ timeout: timeout }).should(
    'eq',
    `${baseUrl}/scores/${roarDemoAdministrationId}/district/${roarDemoDistrictId}`,
  );
}

function setFilterBySchool(school) {
  cy.get('[data-cy="filter-by-school"]', {timeout: timeout}).click();
  cy.get('ul > li', {timeout: timeout}).contains(school).click()
  cy.wait(0.2 * timeout);
}

function checkSchoolColumn(headers) {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();
    cy.log('tableHeaders', tableHeaders)

    headers.forEach((header) => {
      const headerIndex = tableHeaders.indexOf(header);
      cy.log('headerIndex', headerIndex)

      if (headerIndex !== -1) {
        cy.get('[data-cy="roar-data-table"] tbody tr').each(($row) => {
          cy.wrap($row).find('td')
            .eq(headerIndex)
            .then((headerCell) => {
              cy.log('headerCell', headerCell)
              cy.wrap(headerCell).should('contain', "Cypress High School")
            });
        });
      }
    });
  });
}

describe('The partner admin can view score reports for a given administration and filter by school.', () => {
  it('Selects an administration and views its score report, then accesses the filter bar to filter by school.', () => {
    checkUrl();
    cy.getAdministrationCard('ascending', roarDemoAdministrationName);
    clickScoreButton();
    setFilterBySchool('Cypress High School')
    checkSchoolColumn(headers);
  });
});