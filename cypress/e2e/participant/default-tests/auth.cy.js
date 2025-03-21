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
    cy.get('[data-cy="home-participant__administration"]').should('contain', 'Cypress Test Roar Apps Administration');
  });

  it('Logs out', () => {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.waitForParticipantHomepage();
    cy.logout();
  });
});
