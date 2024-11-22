import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const timeout = Cypress.env('timeout');

export const playSRE = ({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  auth = 'username',
} = {}) => {
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.visit('/', { timeout: 2 * timeout });

  if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/', { timeout: 2 * timeout });
  }

  if (auth === 'clever') {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  }
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tablist-tab-list', { timeout: 2 * timeout })
    .contains(languageOptions[language].gameTab)
    .should('exist');
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn', { timeout: 18 * timeout })
    .should('be.visible')
    .click();

  cy.wait(0.2 * timeout);

  // handles error where full screen throws a permissions error
  cy.wait(0.2 * timeout);

  cy.get('body', { timeout: 6 * timeout }).type('{enter}');
  cy.get('body', { timeout: 6 * timeout }).type('{1}');

  playSREGame();

  // check if game completed
  cy.visit('/');
  cy.wait(0.3 * timeout);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.tabview-nav-link-label').contains(languageOptions[language].gameTab).should('exist');
};

function playSREGame() {
  for (let i = 0; i < 50; i++) {
    cy.log('loop 0', i);
    cy.wait(0.3 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.3 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
  }
}
