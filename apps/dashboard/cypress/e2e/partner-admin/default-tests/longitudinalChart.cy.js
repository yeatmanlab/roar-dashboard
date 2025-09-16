const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

const navigateToStudentReport = () => {
  cy.visit(
    `${baseUrl}/scores/${Cypress.env('testAdministrationIdLongitudinal')}/district/${Cypress.env('testDistrictIdLongitudinal')}/user/${Cypress.env('testUserIdLongitudinal')}/new`,
  );
};

describe('Longitudinal Chart Component', () => {
  beforeEach(() => {
    // Login as a partner admin
    cy.login(PARTNER_ADMIN_USERNAME, PARTNER_ADMIN_PASSWORD);
  });

  it('renders the longitudinal chart correctly', () => {
    // Navigate to a student's score report page
    navigateToStudentReport();

    // Click the Progress Over Time accordion panel
    cy.contains('Progress Over Time').click();

    // Verify PrimeVue chart component is rendered inside the accordion
    cy.get('.longitudinal-chart').should('exist');
  });
});
