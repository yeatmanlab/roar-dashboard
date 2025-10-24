const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

const navigateToStudentReport = () => {
  cy.visit(
    `${baseUrl}/scores/${Cypress.env('testAdministrationIdLongitudinal')}/district/${Cypress.env('testDistrictIdLongitudinal')}/user/${Cypress.env('testUserIdLongitudinal')}`,
  );
};

describe('Longitudinal Chart Component', () => {
  beforeEach(() => {
    // Login as a partner admin
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);
  });

  // TODO: Enable this test when longitudinal charts are enabled again
  it.skip('renders the longitudinal chart correctly', () => {
    // Navigate to a student's score report page
    navigateToStudentReport();

    // Click the Progress Over Time accordion panel
    cy.contains('Progress Over Time').click();

    // Verify PrimeVue chart component is rendered inside the accordion
    cy.get('[data-cy="longitudinal-chart"]').should('exist');
  });
});
