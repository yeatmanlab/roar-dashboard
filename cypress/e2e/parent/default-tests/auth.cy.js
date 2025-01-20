import { APP_ROUTES } from '../../../../src/constants/routes';
import { ORG_TYPES } from '../../../../src/constants/orgTypes';

const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');
const PARENT_FIRST_NAME = Cypress.env('PARENT_FIRST_NAME');
const PARENT_LAST_NAME = Cypress.env('PARENT_LAST_NAME');

describe('Parent: Auth', () => {
  it('Shows an error when using invalid invitation codes during sign-up', () => {
    const invalidActivationCode = '123456';

    // Visit the sign-up page with the activation code.
    cy.visit(`${APP_ROUTES.REGISTER}/?code=${invalidActivationCode}`);

    // Fill out parent form.
    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').type(PARENT_PASSWORD);
    cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

    // Accept terms and conditions.
    cy.get('.p-checkbox-input').click();

    // Verify consent dialog.
    cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

    // Submit parent form.
    cy.get('button').contains('Next').click();

    // Validate failure message.
    cy.get('.p-dialog-header').should('be.visible').contains('Error');
    cy.get('.p-dialog-content')
      .should('be.visible')
      .contains(`The code ${invalidActivationCode} does not belong to any organization`);
  });

  it('Validates invitation codes during sign-up', () => {
    const ORG_TYPE = ORG_TYPES.DISTRICTS;
    const ORG_NAME = Cypress.env('testPartnerDistrictName');

    cy.getActivationCode(ORG_TYPE, ORG_NAME).then((activationCode) => {
      // Visit the sign-up page with the activation code.
      cy.visit(`${APP_ROUTES.REGISTER}/?code=${activationCode}`);

      // Fill out parent form.
      cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
      cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
      cy.get('[data-cy="signup__parent-email"]').type(PARENT_USERNAME);
      cy.get('[data-cy="signup__parent-password"]').first().type(PARENT_PASSWORD);
      cy.get('[data-cy="signup__parent-password-confirm"]').type(PARENT_PASSWORD);

      // Accept terms and conditions.
      cy.get('.p-checkbox-input').click();

      // Verify consent dialog.
      cy.get('[data-cy="consent-modal"]').should('be.visible').find('button').contains('Continue').click();

      // Submit parent form.
      cy.get('button').contains('Next').click();

      // Validate success message.
      cy.get('[data-cy="child-registration__org-name"]').should('contain.text', ORG_NAME);
    });
  });
});
