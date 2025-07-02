import { APP_ROUTES } from '../../../../src/constants/routes';
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const CLEVER_SCHOOL_NAME = Cypress.env('cleverSchoolName');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');

describe('Participant: URL Handling', () => {
  it('Redirects to login when unauthenticated user visits home', () => {
    cy.visit(APP_ROUTES.HOME);
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin`);
  });

  it('Redirects to login with redirect_to set to previous path when unauthenticated user visits a protected route', () => {
    cy.visit(APP_ROUTES.ACCOUNT_PROFILE);
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/signin?redirect_to=/profile`);
  });

  it('Redirects to redirect_to path after successfully authenticating with email', () => {
    cy.visit('/game/core-tasks/trog');
    
    cy.get('[data-cy="sign-in__username"]').type(PARTICIPANT_USERNAME, { log: false });
    cy.get('[data-cy="sign-in__password"]').type(PARTICIPANT_PASSWORD, { log: false });
    
    cy.get('button').contains('Go!').click();
    
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/game/core-tasks/trog`);
  }); 

  it('Redirects to redirect_to path after successfully authenticating with Clever SSO', () => {
    const CLEVER_SSO_URL = Cypress.env('cleverOAuthLink');
    
    cy.visit('/game/core-tasks/trog');
    cy.get('[data-cy="sign-in__clever-sso"]').contains('Clever').click();
  
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
        cy.get('ul > li').contains(schoolName).click();
  
        cy.get('input#username').type(username);
        cy.get('input#password').type(password, { log: false });
        cy.wait(1000); // Add a delay to simulate user input, as Clever SSO is sensitive to rapid input.
        cy.get('button#UsernamePasswordForm--loginButton').click();
      },
    );
    
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/game/core-tasks/trog`);
    cy.visit('/')
    return;
  });
});
