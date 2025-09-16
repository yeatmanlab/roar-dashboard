const baseUrl = Cypress.config().baseUrl;

const PARTNER_ADMIN_USERNAME = Cypress.env('PARTNER_ADMIN_USERNAME');
const PARTNER_ADMIN_PASSWORD = Cypress.env('PARTNER_ADMIN_PASSWORD');

// Score report path constants
const ADMINISTRATION_ID = 'K8UaI8p79Dntj5Z2CJk8';
const DISTRICT_ID = 'qoW9OEPcV50rIA2IcqbV';
const USER_ID = 'yXuZ8S0En1UsOE4C0uh6wUlQ5Wt1';

const navigateToStudentReport = () => {
  cy.visit(`${baseUrl}/scores/${ADMINISTRATION_ID}/district/${DISTRICT_ID}/user/${USER_ID}/new`);
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
