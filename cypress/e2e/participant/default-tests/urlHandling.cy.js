import { APP_ROUTES } from '../../../../src/constants/routes';
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const CLEVER_SCHOOL_NAME = Cypress.env('cleverSchoolName');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');

describe('Participant: URL Handling', () => {
  it('Redirects to login when unauthenticated user visits home', () => {
    cy.visit(APP_ROUTES.HOME);
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin`);
  });

  it('Redirects to login with redirect_to set to previous path when unauthenticated user visits a protected route', () => {
    cy.visit(APP_ROUTES.ACCOUNT_PROFILE);
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=/profile`);
  });

  it('Redirects to redirect_to path after successfully authenticating with email', () => {
    cy.visit('/game/core-tasks/trog');

    cy.get('[data-cy="sign-in__username"]').type(PARTICIPANT_USERNAME, { log: false });
    cy.get('[data-cy="sign-in__password"]').type(PARTICIPANT_PASSWORD, { log: false });

    cy.get('[data-cy="sign-in__submit"]').contains('Go!').click();

    cy.url().should('eq', `${Cypress.config().baseUrl}/game/core-tasks/trog`);
  });

  it('Redirects to redirect_to path after successfully authenticating with Clever SSO', () => {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD, '/game/core-tasks/trog');
    cy.visit('/');
    return;
  });
});
