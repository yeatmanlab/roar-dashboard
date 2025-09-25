import { APP_ROUTES } from '../../../../src/constants/routes';
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const CLEVER_SCHOOL_NAME = Cypress.env('cleverSchoolName');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');

describe('Participant: Auth', () => {
  it('Logs in as participant using username and password', () => {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.get('[data-cy="navbar__display-name"]').should('contain', 'Hi, Cypress!');
  });

  // @TODO: Enable test once test account is properly provisioned on test environment.
  it.skip('Logs in as participant using email and password', () => {
    // cy.login(PARTICIPANT_EMAIL, PARTICIPANT_EMAIL_PASSWORD);
    // cy.get('[data-cy="navbar__display-name"]').should('contain', PARTICIPANT_USERNAME);
  });

  it('Logs in as participant using Clever SSO', () => {
    // Perform SSO login flow.
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);

    // Validate that the participant homepage is loaded.
    cy.visit('/');
    cy.waitForParticipantHomepage();
    cy.get('[data-cy="home-participant__administration-emptystate"]').should('not.exist');
    cy.get('[data-cy="dropdown-select-administration"]').click();
    cy.get('.p-select-list-container').find('li').should('contain', 'Cypress Test Roar Apps Administration');
  });

  it('Logs out', () => {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.waitForParticipantHomepage();
    cy.logout();
  });

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
