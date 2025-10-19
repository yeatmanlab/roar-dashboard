const LAUNCH_ADMIN_USERNAME = Cypress.env('LAUNCH_ADMIN_USERNAME');
const LAUNCH_ADMIN_PASSWORD = Cypress.env('LAUNCH_ADMIN_PASSWORD');

describe('Launch Admin: View student score report', () => {
  it("Navigates to view a student's score report", () => {
    cy.login(LAUNCH_ADMIN_USERNAME, LAUNCH_ADMIN_PASSWORD);
    cy.waitForStudentReportList();
    cy.get('[data-cy="view-score-report-btn').first().click();

    cy.get('[data-cy="report__header"] h1').should('contain', 'Individual Score Report');
    cy.get('[data-cy="report__expand-btn"]').contains('Expand All Sections').click();
    cy.get('[data-cy="report__pdf-export-btn"]').contains('Export to PDF');
    cy.get('div').contains('The ROAR assessments return these kinds of scores');
  });
});
