const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');
const ORG_CODE = Cypress.env('ACTIVATION_CODE');

describe('Parent: Add Child', () => {
  beforeEach(() => {
    cy.login(PARENT_USERNAME, PARENT_PASSWORD);
    cy.waitForParentHomepage();
  });

  it('Successfully adds a new child using activation code', () => {
    const CHILD_FIRST_NAME = 'TestChild';

    cy.scrollTo('bottom');

    // @TODO: Remove the force click once the Parent Homepage has been refactored and properly handles loading.
    cy.get('[data-cy="add-student-btn"]').should('be.visible').click({ force: true });

    // Verify enrollment modal is visible
    cy.get('[data-cy="enrollment-modal"]').should('be.visible');
    cy.get('[data-cy="enrollment-modal"] [data-testid="dialog__header"]').should('contain', 'Enroll New Student');

    // Enter activation code
    cy.get('[data-cy="activation-code-group"]').should('be.visible');
    cy.get('[data-cy="activation-code-input"]').should('be.visible');

    cy.get('[data-cy="activation-code-input"]').clear().type(ORG_CODE);
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
    cy.findByTestId('date-picker__year').first().click();

    // Select grade
    cy.get('[data-cy="grade-select"]').should('be.visible').click();
    cy.findByTestId('grade-select__option').first().click();

    // Accept terms and conditions
    cy.get('#accept-register').should('be.visible').click();
    cy.wait(500); // Wait for consent modal if it appears
    cy.get('button').contains('Continue').click();

    // Submit child form
    cy.get('button').contains('Submit').click();

    // Wait until request has completed and modal is closed.
    // @NOTE: The submit requests currently takes quite a long time, hence the manual timeout override.
    cy.waitUntil(
      () => {
        return Cypress.$('[data-cy="enrollment-modal"]').length === 0;
      },
      { timeout: 10000 },
    );

    cy.contains('[data-cy="student-card__name"]', username).should('be.visible');
  });
});
