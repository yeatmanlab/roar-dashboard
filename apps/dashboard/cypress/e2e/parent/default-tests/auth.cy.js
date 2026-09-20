import { APP_ROUTES } from '../../../../src/constants/routes';

const randomNum = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;

const PARENT_USERNAME = Cypress.env('PARENT_EMAIL');
const NEW_PARENT_USERNAME = PARENT_USERNAME.replace('@', `${randomNum}@`);
const PARENT_PASSWORD = Cypress.env('PARENT_PASSWORD');

const PARENT_FIRST_NAME = Cypress.env('PARENT_FIRST_NAME');
const PARENT_LAST_NAME = Cypress.env('PARENT_LAST_NAME');

describe.skip('Parent: Auth', () => {
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

  it('Creates an account and requires an explicit transition to SignIn', () => {
    cy.visit(APP_ROUTES.REGISTER);

    cy.get('[data-cy="signup__parent-first-name"]').type(PARENT_FIRST_NAME);
    cy.get('[data-cy="signup__parent-last-name"]').type(PARENT_LAST_NAME);
    cy.get('[data-cy="signup__parent-email"]').type(NEW_PARENT_USERNAME);
    cy.get('[data-cy="signup__parent-password"]').type(PARENT_PASSWORD);

    cy.get('[name="legalAcceptance"]').click();

    cy.findByTestId('research-consent-modal').should('be.visible').find('button').contains('Continue').click();
    cy.findByTestId('research-consent-modal').should('not.exist');
    cy.get('[name="legalAcceptance"]').should('be.checked');

    cy.get('[data-cy="signup__create-account"]').should('not.be.disabled').click();

    cy.findByRole('heading', { name: 'Account created' }).should('be.focused');
    cy.contains(`Welcome to ROAR, ${PARENT_FIRST_NAME}.`).should('be.visible');
    cy.findByRole('link', { name: /continue to sign in/i }).click();
    cy.location('pathname').should('eq', APP_ROUTES.SIGN_IN);
  });
});
