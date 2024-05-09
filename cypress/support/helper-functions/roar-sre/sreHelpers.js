import { languageOptions } from './languageOptions';

const timeout = Cypress.env('timeout');

export const playSRE = ({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
} = {}) => {
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
  cy.visit('/', { timeout: 2 * timeout });
  cy.selectAdministration(administration);

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tabview', { timeout: 2 * timeout })
    .contains(languageOptions[language].gameTab)
    .should('exist');
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn', { timeout: 60 * timeout })
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

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  cy.get('.tabview-nav-link-label').contains(languageOptions[language].gameTab).should('exist');
};

function playSREGame() {
  for (let i = 0; i < 80; i++) {
    cy.log('loop 0', i);
    cy.wait(0.3 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
    cy.wait(0.3 * timeout);
    cy.get('body').type('{leftarrow}{rightarrow}');
  }
}
