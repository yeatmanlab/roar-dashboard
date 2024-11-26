import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

export const playSRE = ({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  auth = 'username',
} = {}) => {
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.visit('/');

  if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
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

  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(1);

  // handles error where full screen throws a permissions error
  cy.wait(1);

  cy.get('body').type('{enter}');
  cy.get('body').type('{1}');

  playSREGame();

  // check if game completed
  cy.visit('/');
  cy.wait(Cypress.env('timeout'));
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
    cy.wait(Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
  }
}
