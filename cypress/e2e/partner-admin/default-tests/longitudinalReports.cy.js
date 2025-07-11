const baseUrl = Cypress.config().baseUrl;
const testDistrictId = Cypress.env('testDistrictId');
const testPartnerAdministrationName = Cypress.env('testPartnerAdministrationName');
const testPartnerAdministrationId = Cypress.env('testPartnerAdministrationId');
const testPartnerAdminUsername = Cypress.env('PARTNER_ADMIN_USERNAME');
const testPartnerAdminPassword = Cypress.env('PARTNER_ADMIN_PASSWORD');
const testUserList = Cypress.env('testUserList');

describe('Partner Admin: Longitudinal Reports', () => {
  beforeEach(() => {
    // Login as a partner admin before each test
    cy.login(testPartnerAdminUsername, testPartnerAdminPassword);
    cy.waitForAdministrationsList();
  });

  it("Views a student's longitudinal report", () => {
    // Select the test administration and open the details page
    cy.getAdministrationCard(testPartnerAdministrationName);

    // Open the score report
    cy.get('button').contains('Scores').first().click();
    cy.url().should('eq', `${baseUrl}/scores/${testPartnerAdministrationId}/district/${testDistrictId}`);

    // Validate that test users are present
    cy.checkUserList(testUserList);

    // Open the individual report for the first student
    cy.get('[data-cy="data-table__entry-details-btn"]').first().click();
    
    // Click View Longitudinal Report button
    cy.get('[data-cy="report__longitudinal-btn"]').click();

    // Verify we're on the longitudinal report page
    cy.url().should('include', '/longitudinal');
    cy.get('[data-cy="report__header"] h1').should('contain', 'Longitudinal Report');

    // Wait for loading to complete
    cy.get('.loading-container').should('not.exist', { timeout: 10000 });

    // Check if there is data
    cy.get('body').then($body => {
      if ($body.find('.flex.flex-column.align-items-center.py-6.bg-gray-100').length > 0) {
        // No data case
        cy.get('.flex.flex-column.align-items-center.py-6.bg-gray-100')
          .should('be.visible')
          .and('contain', 'need to complete at least one assessment');
      } else {
        // Data exists case
        cy.get('[data-cy="report__expand-btn"]').contains('Expand All Sections').click();
        
        // Wait for accordion to be ready
        cy.get('.p-accordion').should('be.visible');
        cy.get('.border-2.border-gray-300.border-round-lg').should('have.length.at.least', 1);

        // Verify administration content
        cy.get('.text-xl').should('be.visible'); // Administration name
        cy.get('.text-sm').should('be.visible'); // Date info
        
        // Verify task list is present
        cy.get('ul').should('be.visible');
        cy.get('li strong').should('be.visible');
      }
    });

    // Test PDF export functionality
    cy.get('[data-cy="report__pdf-export-btn"]')
      .should('be.visible')
      .and('not.be.disabled')
      .click();

    // Check loading state via button icon
    cy.get('[data-cy="report__pdf-export-btn"] .pi-spin.pi-spinner')
      .should('be.visible')
      .then(() => {
        // Wait for loading to complete (icon changes back)
        cy.get('[data-cy="report__pdf-export-btn"] .pi-download', { timeout: 10000 }).should('be.visible');
      });
  });

});
