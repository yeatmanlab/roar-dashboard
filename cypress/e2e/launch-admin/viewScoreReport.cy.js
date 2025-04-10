const timeout = Cypress.env('timeout');

const LAUNCH_ADMIN_USERNAME = Cypress.env('LAUNCH_ADMIN_USERNAME');
const LAUNCH_ADMIN_PASSWORD = Cypress.env('LAUNCH_ADMIN_PASSWORD');

describe('Launch Admin: launch student', () => {
  it("Navigates to view a student's score report", () => {
    cy.login(LAUNCH_ADMIN_USERNAME, LAUNCH_ADMIN_PASSWORD);
    cy.waitForStudentReportList();
    cy.get('[data-cy="view-score-report-btn').first().click();

    cy.get('body', { timeout: 3 * timeout }).should('contain', 'Individual Score Report');
    cy.get('button', { timeout: 3 * timeout })
      .contains('Expand All Sections')
      .click();
    cy.get('button', { timeout: 3 * timeout }).contains('Export to PDF');
    cy.get('div', { timeout: 3 * timeout }).contains('The ROAR assessments return these kinds of scores');
  });
});
