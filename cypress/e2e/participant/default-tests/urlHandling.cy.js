import { APP_ROUTES } from '../../../../src/constants/routes';
// @TODO Add tests for after successfully logging in for email & Google sign-ins.
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');
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

  it('Redirects to login with a redirect_to set to previous path', () => {
    cy.visit(APP_ROUTES.ACCOUNT_PROFILE);
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.wait(0.2 * Cypress.env('timeout'));
    cy.url().should('eq', `${Cypress.config().baseUrl}/profile`);
  });
});
