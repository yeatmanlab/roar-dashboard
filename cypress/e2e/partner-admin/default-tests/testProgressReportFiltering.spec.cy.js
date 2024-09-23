// *** ================================================================================================ ***
// *** Commenting out this test until it can be transitioned to a more comprehensive, independent component test. ***
// *** ================================================================================================ ***

// const testDistrictId = Cypress.env('testDistrictId');
// const roarDemoDistrictId = Cypress.env('testDistrictId');
// const roarDemoAdministrationName = Cypress.env('testPartnerAdministrationName');
// const roarDemoAdministrationId = Cypress.env('testPartnerAdministrationId');
// const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
// const testAdministrationId = Cypress.env('testAdministrationId');
// const roarTestAdministrationName = Cypress.env('testRoarAppsAdministration');
// const roarTestAdministrationId = Cypress.env('testRoarAppsAdministrationId');
// const timeout = Cypress.env('timeout');
// const baseUrl = Cypress.env('baseUrl');
// const testPartnerAdminUsername = Cypress.env('partnerAdminUsername');
// const testPartnerAdminPassword = Cypress.env('partnerAdminPassword');
// const testUserList = Cypress.env('testUserList');
// const testAssignments = Cypress.env('testAssignmentsList');
// const headers = ['School'];

// function checkUrl() {
//   cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
//   cy.navigateTo('/');
//   cy.url({ timeout: 3 * timeout }).should('eq', `${baseUrl}/`);
// }

//

// function clickProgressButton(adminId) {
//   cy.get('button', { timeout: timeout }).contains('Progress').first().click();
//   cy.url({ timeout: 3 * timeout }).should('eq', `${baseUrl}/administration/${adminId}/district/${testDistrictId}`);
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
//   cy.get('body').type('{esc}');
//   cy.wait(0.05 * timeout);
// }

//

// function setFilterByProgressCategory(header, category) {
//   cy.contains('div.p-column-header-content', header).find('button').click();
//   cy.get('[data-cy="progress-filter-dropdown"]', { timeout: timeout }).click();
//   cy.get('ul>li').find('.p-tag-value', { timeout: timeout }).contains(category).click();
//   // Click off the dropdown to prevent it from hiding other elements
//   cy.get('button').contains('Apply').click();
//   cy.wait(0.05 * timeout);
// }

//
// function checkTableColumn(headers, value) {
//   cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
//     const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();
//
//     headers.forEach((header) => {
//       const headerIndex = tableHeaders.indexOf(header);
//

//       if (headerIndex !== -1) {
//         cy.get('[data-cy="roar-data-table"] tbody tr').each(($row) => {
//           cy.wrap($row)
//             .find('td')
//             .eq(headerIndex)
//             .then((headerCell) => {
//               cy.wrap(headerCell).should('contain', value);
//             });
//         });
//       }
//     });
//   });
// }

//
// function checkProgressTags(headers) {
//   cy.get('[data-cy="roar-data-table"] thead th').then(($header) => {
//     const tableHeaders = $header.map((index, elem) => Cypress.$(elem).text()).get();
//
//     headers.forEach((header) => {
//       const headerIndex = tableHeaders.indexOf(header);
//

//       if (headerIndex !== -1) {
//         cy.get('[data-cy="roar-data-table"] tbody tr', { timeout: timeout }).each(($row) => {
//           cy.wrap($row)
//             .find('td')
//             .eq(headerIndex)
//             .then((headerCell) => {
//               cy.wrap(headerCell).find('span.p-tag.p-component').should('exist');
//             });
//         });
//       }
//     });
//   });
// }

//

// describe('The partner admin can view progress reports for a given administration and filter by school.', () => {
//   it('Selects an administration and views its score report, then accesses the filter bar to filter by school.', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickProgressButton(roarTestAdministrationId);
//     setFilterBySchool('Cypress Test School');
//     checkTableColumn(headers, 'Cypress Test School');
//   });
// });

//

// describe('The partner admin can view progress reports for a given administration and filter by grade', () => {
//   it('Selects an administration, views its progress report, then accesses the filter bar to filter by grade', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarDemoAdministrationName, 'descending');
//     clickProgressButton(roarDemoAdministrationId);
//     setFilterByGrade('1');
//     checkTableColumn(['Grade'], '1');
//   });
// });

//

// describe('The partner admin can view progress reports for a given administration and filter by both school and grade', () => {
//   it('Selects an administration, views its progress report, then accesses the filter bar to filter by both school grade', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarDemoAdministrationName, 'descending');
//     clickProgressButton(roarDemoAdministrationId);
//     setFilterByGrade('1');
//     setFilterBySchool('Cypress Test School');
//     checkTableColumn(headers, 'Cypress Test School');
//     checkTableColumn(['Grade'], '1');
//   });
// });

//

// describe('The partner admin can view progress reports for a given administration and filter by progress status', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by progress status', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickProgressButton(roarTestAdministrationId);
//     setFilterByProgressCategory('ROAR - Word', 'completed');
//     checkTableColumn(['Username'], 'CypressTestStudent0');
//   });
// });

//

// describe('The partner admin can view progress reports for a given administration and filter by grade and progress status', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by grade and support level', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickProgressButton(roarTestAdministrationId);
//     setFilterByGrade('1');
//     setFilterByProgressCategory('ROAR - Word', 'completed');
//     checkTableColumn(['Username'], 'CypressTestStudent0');
//   });
// });

//

// describe('The partner admin can view progress reports for a given administration and a not applicable filter returns an empty message', () => {
//   it('Selects an administration, views its score report, then accesses the column filter to filter by a non-returnable filter', () => {
//     checkUrl();
//     cy.getAdministrationCard(roarTestAdministrationName, 'descending');
//     clickProgressButton(roarTestAdministrationId);
//     setFilterByProgressCategory('ROAR - Written Vocab', 'started');
//     cy.get('.p-datatable-emptymessage').contains('No results found');
//     cy.get('.p-datatable-emptymessage').contains('Reset Filters');
//   });
// });
