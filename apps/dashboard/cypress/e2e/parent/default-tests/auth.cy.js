import { APP_ROUTES } from '../../../../src/constants/routes';

const randomNum = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;

const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const NEW_PARENT_USERNAME = PARENT_USERNAME.replace('@', `${randomNum}@`);
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');

const PARENT_FIRST_NAME = Cypress.env('PARENT_FIRST_NAME');
const PARENT_LAST_NAME = Cypress.env('PARENT_LAST_NAME');

describe('Parent: Auth', () => {
  it('Logs in as parent using username and password', () => {
    cy.login(PARENT_USERNAME, PARENT_PASSWORD);
    cy.waitForParentHomepage();
    cy.get('[data-cy="parent-homepage"]').should('exist');
  });

  it('Logs out', () => {
    cy.login(PARENT_USERNAME, PARENT_PASSWORD);
    cy.waitForParentHomepage();
    cy.logout();
  });

  it('Shows an error when using invalid invitation codes during student enrollment', () => {
    const invalidActivationCode = '123456';

    // Visit the sign-up page with the invalid activation code.
    cy.visit(`${APP_ROUTES.REGISTER}/?code=${invalidActivationCode}`);

    // Fill out parent form (code validation now happens during student enrollment).
    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(NEW_PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').type(PARENT_PASSWORD);
    cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

    // Accept terms and conditions.
    cy.findByTestId('checkbox__input').click();

    // Verify consent dialog.
    cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

    // Submit parent form (should succeed - validation moved to student enrollment).
    cy.get('button').contains('Register').click();

    // Wait for parent dashboard to load.
    cy.waitForParentHomepage();

    // Click "Add Child" to open enrollment modal.
    cy.get('[data-cy="add-student-btn"]').click();

    // Verify the invalid code is pre-populated in the student enrollment form.
    cy.get('[data-cy="activation-code-input"]').should('have.value', invalidActivationCode);

    // Fill out student form.
    cy.get('[data-cy="student-username-input"]').type('teststudent');
    cy.get('[data-cy="student-password-input"]').type('TestPassword123!');
    cy.get('[data-cy="student-confirm-password-input"]').type('TestPassword123!');
    // Note: First name and last name selectors need to be checked in the component

    // Validate the activation code (should fail).
    cy.get('button').contains('Validate').click();

    // Validate failure message appears.
    cy.findByTestId('dialog__header').should('be.visible').contains('Error');
    cy.findByTestId('dialog__content')
      .should('be.visible')
      .contains(`The code ${invalidActivationCode} does not belong to any organization`);
  });

  it('Validates invitation codes during student enrollment', () => {
    const ORG_CODE = Cypress.env('ACTIVATION_CODE');
    const ORG_NAME = Cypress.env('testInviteGroupName');

    // Visit the sign-up page with valid activation code.
    cy.visit(`${APP_ROUTES.REGISTER}/?code=${ORG_CODE}`);

    // Fill out parent form (code is stored for later use).
    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(NEW_PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').first().type(PARENT_PASSWORD);
    cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

    // Accept terms and conditions.
    cy.findByTestId('checkbox__input').click();

    // Verify consent dialog.
    cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

    // Submit parent form (should succeed - code stored for student enrollment).
    cy.get('button').contains('Register').click();

    // Wait for parent dashboard to load.
    cy.waitForParentHomepage();

    // Click "Add Child" to open enrollment modal.
    cy.get('[data-cy="add-student-btn"]').click();

    // Verify the valid code is pre-populated in the student enrollment form.
    cy.get('[data-cy="activation-code-input"]').should('have.value', ORG_CODE);

    // Fill out student form.
    cy.get('[data-cy="student-username-input"]').type('teststudent');
    cy.get('[data-cy="student-password-input"]').type('TestPassword123!');
    cy.get('[data-cy="student-confirm-password-input"]').type('TestPassword123!');
    // Note: First name and last name selectors need to be checked in the component

    // Validate the activation code (should succeed).
    cy.get('button').contains('Validate').click();

    // Validate success - organization name should be displayed.
    cy.get('[data-cy="child-registration__org-name"]').should('contain.text', ORG_NAME);

    // Submit student enrollment.
    cy.get('button').contains('Submit').click();

    // Verify success toast message appears.
    cy.get('.p-toast-message').should('be.visible').contains('Student successfully enrolled');
  });
});
