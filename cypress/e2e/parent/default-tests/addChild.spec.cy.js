import { APP_ROUTES } from '../../../../src/constants/routes';

const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');

describe('Parent: Add Child', () => {
  beforeEach(() => {
    // Login as parent first
    cy.visit(APP_ROUTES.SIGN_IN);
    cy.get('[data-cy="sign-in__username"]').type(PARENT_USERNAME);
    cy.get('[data-cy="sign-in__password"]').type(PARENT_PASSWORD);
    cy.get('button[type="submit"]').click();

    // Wait for home page to load
    cy.url().should('include', APP_ROUTES.HOME);
  });

  it('Successfully adds a new child using activation code', () => {
    const ORG_CODE = Cypress.env('ACTIVATION_CODE');
    const CHILD_FIRST_NAME = 'TestChild';

    // Click on Add Student button
    cy.get('[data-cy="add-student-btn"]').click();

    // Verify enrollment modal is visible
    cy.get('[data-cy="enrollment-modal"]').should('be.visible');
    cy.get('[data-cy="enrollment-modal"] .p-dialog-header').should('contain', 'Enroll New Student');

    // Enter activation code
    cy.get('[data-cy="activation-code-group"]').should('be.visible');
    cy.get('[data-cy="activation-code-input"]').should('be.visible').clear().type(ORG_CODE, { force: true });
    cy.get('button').contains('Validate').click();

    // Generate unique username with random number
    const randomNum = Math.floor(Math.random() * 1000000);
    const username = `${CHILD_FIRST_NAME}${randomNum}`;

    // Fill out child information
    cy.get('[data-cy="student-username-input"]').should('be.visible').type(username);

    // Enter password
    cy.get('[data-cy="student-password-input"] input').should('be.visible').type('password123');
    cy.get('[data-cy="student-confirm-password-input"] input').should('be.visible').type('password123');

    // Check 'Use Year Only' for birth date
    cy.get('[data-cy="year-only-checkbox"]').should('be.visible').click();

    // Set birth year in the date picker
    cy.get('[data-cy="dob-year-picker"] input').should('be.visible').click();
    cy.get('.p-datepicker-year').first().click();

    // Select grade
    cy.get('[data-cy="grade-select"]').should('be.visible').click();
    cy.get('.p-select-option').first().click();

    // Accept terms and conditions
    cy.get('#accept-register').should('be.visible').click();
    cy.wait(500); // Wait for consent modal if it appears
    cy.get('button').contains('Continue').click();

    // Submit child form
    cy.get('button').contains('Submit').click();

    // Wait for loading state to complete
    cy.contains('Administration enrollment in progress', { timeout: Cypress.env('timeout') }).should('be.visible');

    // Verify successful registration
    cy.get('article.flex.overflow-hidden h2', { timeout: Cypress.env('timeout') }).should('contain', username);
  });
});
