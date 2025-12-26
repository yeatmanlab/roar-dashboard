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
    // Perform SSO login flow (includes waiting for /sso page and redirect to home).
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);

    // Wait for participant homepage to fully load and handle any consent dialogs.
    cy.waitForParticipantHomepage();
    cy.agreeToConsent();

    // Validate that the participant homepage loaded with assignments.
    cy.get('[data-cy="home-participant__administration-emptystate"]').should('exist');

    // @NOTE: The participant test account currently has no assignments.
    // cy.get('[data-cy="dropdown-select-administration"]').click();
    // cy.get('.p-select-list-container').find('li').should('contain', 'Cypress Test Roar Apps Administration');
  });

  it('Shows error state when SSO user has no userType', () => {
    // Intercept Firestore requests to reove userType from responses.
    // This simulates an unprovisioned user without needing a separate test account.
    cy.interceptUserDataWithoutUserType();

    // Navigate to sign-in page and set E2E flag for reduced polling attempts.
    cy.visit(APP_ROUTES.SIGN_IN, {
      onBeforeLoad(win) {
        win.localStorage.setItem('__E2E__', 'true');
      },
    });
    cy.performCleverOAuth(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);

    // Wait for error state to appear (polling exhausted retries without finding userType).
    // In test environment, uses 3 attempts with 200ms starting delay and 1.5x multiplier.
    // Total time: ~2-5 seconds depending on network latency + time for roarUid to become available.
    cy.get('[data-cy="sso-auth-page__error-state"]', { timeout: 30000 }).should('be.visible');

    // Verify error state UI elements are visible.
    cy.get('[data-cy="sso-auth-page__retry-btn"]').should('be.visible').and('contain', 'Try Again');
    cy.get('[data-cy="sso-auth-page__signout-btn"]').should('be.visible').and('contain', 'Sign Out');

    // Verify the error message content.
    cy.get('[data-cy="app-message-state__title"]').should('contain', 'Unable to complete sign-in');
    cy.get('[data-cy="app-message-state__message"]').should('contain', 'trouble setting up your account');

    // Test sign out button works.
    cy.get('[data-cy="sso-auth-page__signout-btn"]').click();
    cy.url().should('include', APP_ROUTES.SIGN_IN);
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
    // list-orgs is not accessable to participants, but this test is only for testing the redirect_to functionality.
    cy.visit(APP_ROUTES.ORGS_LIST);
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=${APP_ROUTES.ORGS_LIST}`);
  });

  it('Redirects to redirect_to path after successfully authenticating with email', () => {
    cy.visit('/game/core-tasks/trog');

    cy.get('[data-cy="sign-in__username"]').type(PARTICIPANT_USERNAME, { log: false });
    cy.get('[data-cy="signin-continue"]').click();
    cy.get('[data-cy="sign-in__password"]').type(PARTICIPANT_PASSWORD, { log: false });

    cy.get('[data-cy="signin-continue"]').click();

    cy.url().should('eq', `${Cypress.config().baseUrl}/game/core-tasks/trog`);
  });

  it('Redirects to redirect_to path after successfully authenticating with Clever SSO', () => {
    const redirectTarget = '/game/core-tasks/trog';
    const CLEVER_SSO_URL = Cypress.env('cleverOAuthLink');

    // Visit protected route while unauthenticated.
    cy.visit(redirectTarget);

    // Should redirect to signin with redirect_to query param.
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=${redirectTarget}`);

    // Click Clever SSO button.
    cy.get('[data-cy="sign-in__clever-sso"]').contains('Clever').click();

    // Complete Clever OAuth flow.
    cy.origin(
      CLEVER_SSO_URL,
      {
        args: {
          schoolName: CLEVER_SCHOOL_NAME,
          username: CLEVER_USERNAME,
          password: CLEVER_PASSWORD,
        },
      },
      ({ schoolName, username, password }) => {
        cy.get('input[title="School name"]').type(schoolName);
        cy.get('ul > li').contains(schoolName).should('be.visible').click();

        cy.get('input#username').type(username);
        cy.get('input#password').type(password, { log: false });
        cy.wait(1000);
        cy.get('button#UsernamePasswordForm--loginButton').click();
      },
    );

    // Verify we landed on the original redirect target, not home.
    cy.url().should('include', redirectTarget);
  });
});
