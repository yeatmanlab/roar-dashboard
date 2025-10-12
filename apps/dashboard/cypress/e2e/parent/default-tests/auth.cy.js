import { APP_ROUTES } from '../../../../src/constants/routes';

const randomNum = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;

const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const NEW_PARENT_USERNAME = PARENT_USERNAME.replace('@', `${randomNum}@`);
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');

const PARENT_FIRST_NAME = Cypress.env('PARENT_FIRST_NAME');
const PARENT_LAST_NAME = Cypress.env('PARENT_LAST_NAME');

describe('Parent: Auth', () => {
  it('Logs in as parent using username and password', () => {
    cy.loginEducator(PARENT_USERNAME, PARENT_PASSWORD);
    cy.waitForParentHomepage();
    cy.get('[data-cy="parent-homepage"]').should('exist');
  });

  it('Logs out', () => {
    cy.loginEducator(PARENT_USERNAME, PARENT_PASSWORD);
    cy.waitForParentHomepage();
    cy.logout();
  });

  it('Shows an error when using invalid invitation codes during sign-up', () => {
    const invalidActivationCode = '123456';

    // Visit the sign-up page with the activation code.
    cy.visit(`${APP_ROUTES.REGISTER}/?code=${invalidActivationCode}`);

    // Fill out parent form.
    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(NEW_PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').type(PARENT_PASSWORD);
    cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

    // Accept terms and conditions.
    cy.findByTestId('checkbox__input').click();

    // Verify consent dialog.
    cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

    // Submit parent form.
    cy.get('button').contains('Next').click();

    // Validate failure message.
    cy.findByTestId('dialog__header').should('be.visible').contains('Error');
    cy.findByTestId('dialog__content')
      .should('be.visible')
      .contains(`The code ${invalidActivationCode} does not belong to any organization`);
  });

  it('Validates invitation codes during sign-up', () => {
    const ORG_CODE = Cypress.env('ACTIVATION_CODE');
    const ORG_NAME = Cypress.env('testInviteGroupName');

    cy.visit(`${APP_ROUTES.REGISTER}/?code=${ORG_CODE}`);

    // Fill out parent form.
    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(NEW_PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').first().type(PARENT_PASSWORD);
    cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

    // Accept terms and conditions.
    cy.findByTestId('checkbox__input').click();

    // Verify consent dialog.
    cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

    // Submit parent form.
    cy.get('button').contains('Next').click();

    // Validate success message.
    cy.get('[data-cy="child-registration__org-name"]').should('contain.text', ORG_NAME);
  });
});
