const timeout = Cypress.env('timeout');

const LAUNCH_ADMIN_USERNAME = Cypress.env('LAUNCH_ADMIN_USERNAME');
const LAUNCH_ADMIN_PASSWORD = Cypress.env('LAUNCH_ADMIN_PASSWORD');

describe('Launch Admin: Launch Student', () => {
  it("Navigates to launch into user's assessments", () => {
    cy.login(LAUNCH_ADMIN_USERNAME, LAUNCH_ADMIN_PASSWORD);
    cy.waitForStudentReportList();
    cy.get('[data-cy="play-assessments-btn').first().click();

    cy.waitForParticipantHomepage();
    cy.get('[data-cy="participant-launch-mode"]').should('contain', 'external launch mode');
  });
});
