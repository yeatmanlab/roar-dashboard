import { languageOptions } from './languageOptions';

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
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
    cy.visit('/');
  }
  if (auth === 'clever') {
    cy.loginWithClever(Cypress.env('cleverSchoolName'), Cypress.env('CLEVER_USERNAME'), Cypress.env('CLEVER_PASSWORD'));
  }
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tabview').contains(languageOptions[language].gameTab).should('exist');
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(0.2 * Cypress.env('timeout'));

  // handles error where full screen throws a permissions error
  cy.wait(0.2 * Cypress.env('timeout'));

  cy.get('body').type('{enter}');
  cy.get('body').type('{1}');

  playSREGame();

  // check if game completed
  cy.visit('/');
  cy.wait(0.3 * Cypress.env('timeout'));
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
    cy.wait(0.3 * Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.3 * Cypress.env('timeout'));
    cy.get('body').type('{leftarrow}{rightarrow}');
  }
}
