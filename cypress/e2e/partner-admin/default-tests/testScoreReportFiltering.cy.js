const roarDemoDistrictId = Cypress.env('testDistrictId');
const roarDemoAdministrationName = Cypress.env('testPartnerAdministrationName');
const roarDemoAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
const timeout = Cypress.env('timeout');
const baseUrl = Cypress.env('baseUrl');
const headers = ['School'];

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
  cy.get('[data-cy="filter-by-school"]', { timeout: timeout }).click();
  cy.get('ul > li', { timeout: timeout }).contains(school).click();
  cy.wait(0.2 * timeout);
}

function setFilterByGrade(grade) {
  cy.get('[data-cy="filter-by-grade"]', { timeout: timeout }).click();
  cy.get('ul > li', { timeout: timeout }).contains(grade).click();
  cy.wait(0.2 * timeout);
}

function checkTableColumn(headers, value) {
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
              cy.wrap(headerCell).should('contain', value);
            });
        });
      }
    });
  });
}

describe('The partner admin can view score reports for a given administration and filter by school.', () => {
  it('Selects an administration and views its score report, then accesses the filter bar to filter by school.', () => {
    checkUrl();
    cy.getAdministrationCard(roarDemoAdministrationName, 'ascending');
    clickScoreButton();
    setFilterBySchool('zzzCypressTestSchool');
    checkTableColumn(headers, 'zzzCypressTestSchool');
  });
});

describe('The partner admin can view score reports for a given administration and filter by grade', () => {
  it('Selects an administration, views its score report, then accessed the filter bar to filter by grade', () => {
    checkUrl();
    cy.getAdministrationCard(roarDemoAdministrationName, 'ascending');
    clickScoreButton();
    setFilterByGrade('3');
    checkTableColumn(['Grade'], '3');
  });
});

describe('The partner admin can view score reports for a given administration and filter by both school and grade', () => {
  it('Selects an administration, views its score report, then accessed the filter bar to filter by both school grade', () => {
    checkUrl();
    cy.getAdministrationCard(roarDemoAdministrationName, 'ascending');
    clickScoreButton();
    setFilterByGrade('5');
    setFilterBySchool('zzzCypressTestSchool');
    checkTableColumn(headers, 'zzzCypressTestSchool');
    checkTableColumn(['Grade'], '5');
  });
});
