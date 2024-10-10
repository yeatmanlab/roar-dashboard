// *** ================================================================================================ ***
// *** Commenting out this test until it can be transitioned to a more comprehensive, independent component test. ***
// *** ================================================================================================ ***

// const roarDemoDistrictId = Cypress.env('testDistrictId');
// const roarDemoAdministrationName = Cypress.env('testPartnerAdministrationName');
// const roarTestAdministrationName = Cypress.env('testRoarAppsAdministration');
// const roarTestAdministrationId = Cypress.env('testRoarAppsAdministrationId');
// const roarDemoAdministrationId = Cypress.env('testPartnerAdministrationId');
// const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
// const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
// const timeout = Cypress.env('timeout');
// const baseUrl = Cypress.env('baseUrl');
// const headers = ['School'];

//

// function checkUrl() {
//   cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
//   cy.navigateTo('/');
//   cy.url({ timeout: timeout }).should('eq', `${baseUrl}/`);
// }

//

// function clickScoreButton(adminId) {
//   cy.get('button', { timeout: timeout }).contains('Scores').first().click();
//   cy.url({ timeout: timeout }).should('eq', `${baseUrl}/scores/${adminId}/district/${roarDemoDistrictId}`);
// }

//

// function setFilterBySchool(school) {
//   cy.get('[data-cy="filter-by-school"]', { timeout: timeout }).click();
//   cy.get('ul > li', { timeout: timeout }).contains(school).click();
//   cy.wait(0.05 * timeout);
// }

//

// function setFilterByGrade(grade) {
//   cy.get('[data-cy="filter-by-grade"]', { timeout: timeout }).click();
//   cy.get('ul > li', { timeout: timeout }).contains(grade).click();
//   cy.wait(0.05 * timeout);
// }

// function setFilterByProgressCategory(header, category) {
//   cy.contains('div.p-column-header-content', header).find('button').click();
//   cy.get('[data-cy="score-filter-dropdown"]', { timeout: timeout }).click();
//   cy.get('ul>li').find('.p-tag-value', { timeout: timeout }).contains(category).click();
//   cy.get('button').contains('Apply').click();
//   cy.wait(0.05 * timeout);
// }

//

// function setFilterByScoreCategory(header, category) {
//   cy.contains('div.p-column-header-content', header).find('button').click();
//   cy.get('[data-cy="score-filter-dropdown"]', { timeout: timeout }).click();
//   cy.get('ul > li', { timeout: timeout }).contains(category).click();
//   cy.get('button').contains('Apply').click();
//   cy.wait(0.05 * timeout);
// }

//
function checkTableColumn(headers, value) {
  cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
    const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();

    headers.forEach((header) => {
      const headerIndex = tableHeaders.indexOf(header);

      if (headerIndex !== -1) {
        cy.get('[data-cy="roar-data-table"] tbody').each(($row) => {
          cy.wrap($row).find('tr').should('contain', value);
        });
      }
    });
  });
}

// describe('The partner admin can view score reports for a given administration and filter by school.', () => {
//   it('Selects an administration and views its score report, then accesses the filter bar to filter by school.', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarDemoAdministrationName, 'descending');
//     clickScoreButton(roarDemoAdministrationId);
//     setFilterBySchool('Cypress Test School');
//     checkTableColumn(headers, 'Cypress Test School');
//   });
// });

// describe('The partner admin can view score reports for a given administration and filter by grade', () => {
//   it('Selects an administration, views its score report, then accesses the filter bar to filter by grade', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarDemoAdministrationName, 'descending');
//     clickScoreButton(roarDemoAdministrationId);
//     setFilterByGrade('3');
//     checkTableColumn(['Grade'], '3');
//   });
// });

// describe('The partner admin can view score reports for a given administration and filter by both school and grade', () => {
//   it('Selects an administration, views its score report, then accesses the filter bar to filter by both school grade', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarDemoAdministrationName, 'descending');
//     clickScoreButton(roarDemoAdministrationId);
//     setFilterByGrade('5');
//     setFilterBySchool('Cypress Test School');
//     checkTableColumn(headers, 'Cypress Test School');
//     checkTableColumn(['Grade'], '5');
//   });
// });

// describe('The partner admin can view score reports for a given administration and filter by support level', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by support level', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickScoreButton(roarTestAdministrationId);
//     setFilterByScoreCategory('ROAR - Word', 'Pink');
//     checkTableColumn(['Username'], 'CypressTestStudent0');
//   });
// });

// describe('The partner admin can view score reports for a given administration filter by school, grade, and progress status: completed', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by school, grade, and completed', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickScoreButton(roarTestAdministrationId);
//     setFilterByGrade('1');
//     setFilterBySchool('Cypress Test School');
//     setFilterByProgressCategory('ROAR - Morphology', 'completed');
//     checkTableColumn(['Username'], 'CypressTestStudent0');
//   });
// });

// describe('The partner admin can view score reports for a given administration and filter by Assessed', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by assessed', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickScoreButton(roarTestAdministrationId);
//     setFilterByScoreCategory('ROAR - Morphology', 'Assessed');
//     checkTableColumn(['Username'], 'CypressTestStudent0');
//   });
// });

// describe('The partner admin can view score reports for a given administration and a not applicable filter returns an empty message', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by a non-returnable filter', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickScoreButton(roarTestAdministrationId);
//     setFilterByScoreCategory('ROAR - Written Vocab', 'Optional');
//     cy.get('.p-datatable-emptymessage').contains('No results found');
//     cy.get('.p-datatable-emptymessage').contains('Reset Filters');
//   });
// });
