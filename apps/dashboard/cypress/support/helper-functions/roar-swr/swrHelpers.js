import { languageOptions } from './languageOptions';

const baseTimeout = Cypress.env('timeout');

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

const timeout = Cypress.env('timeout');

export const playSWR = ({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  auth = 'username',
} = {}) => {
  // Log in once at the beginning of the test case that calls playSWR
  if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
  }
  if (auth === 'clever') {
    cy.visit('/');
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  }

  cy.waitForParticipantHomepage();
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
  cy.visit(languageOptions[language].url);

  cy.waitForAssessmentReadyState();
  cy.get('.jspsych-btn', { timeout: 18 * baseTimeout })
    .should('be.visible')
    .click();

  cy.wait(0.1 * baseTimeout);
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  playSWRGame(administration, language, optional);
};

function playSWRGame(administration, language, optional = false) {
  // play tutorial
  cy.contains(languageOptions[language].introText, { timeout: baseTimeout });
  for (let i = 0; i < 3; i++) {
    cy.get('body', { timeout: baseTimeout }).type('{leftarrow}');
  }
  cy.get('.jspsych-btn', { timeout: 10 * baseTimeout })
    .should('be.visible')
    .click();
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  // intro
  playIntro(language);

  playSWRBlock(language, languageOptions[language].blockTerminationPhraseOne);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseTwo);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseThree);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseFour);
  playSWRBlock(language, languageOptions[language].blockTerminationPhraseFive);
  finishSWR(languageOptions[language].blockTerminationPhraseSix);

  // check if game completed
  cy.visit('/');
  cy.wait(0.2 * baseTimeout);

  cy.waitForParticipantHomepage();
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function playIntro(language) {
  for (let i = 0; i <= 5; i++) {
    cy.log(i);
    cy.wait(0.2 * baseTimeout);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 5 * baseTimeout });
    cy.wait(0.2 * baseTimeout);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 2 * baseTimeout });
    cy.wait(0.2 * baseTimeout);
  }
  cy.get('.jspsych-btn', { timeout: 5 * baseTimeout })
    .contains(languageOptions[language].continue)
    .click();
  Cypress.on('uncaught:exception', () => {
    return false;
  });
}

function playSWRBlock(language, block_termination_phrase) {
  cy.wait(0.3 * baseTimeout);
  cy.get('body', { timeout: 5 * baseTimeout }).then((body) => {
    cy.log('entering stage: ', block_termination_phrase);
    if (!body.find('.stimulus').length > 0) {
      cy.get('body', { timeout: baseTimeout }).type('{leftarrow}');
      cy.get('.jspsych-btn', { timeout: 5 * baseTimeout })
        .contains(languageOptions[language].continue, { timeout: 5 * baseTimeout })
        .click();
      Cypress.on('uncaught:exception', () => {
        return false;
      });
    } else {
      cy.get('body', { timeout: baseTimeout }).type('{rightarrow}');
      cy.get('body', { timeout: baseTimeout }).type('{leftarrow}');
      playSWRBlock(language, block_termination_phrase);
    }
  });
}

function finishSWR(block_termination_phrase) {
  cy.wait(0.3 * baseTimeout);
  cy.get('body', { timeout: 5 * baseTimeout }).then((body) => {
    if (!body.find('.stimulus').length > 0) {
      assert(cy.contains(block_termination_phrase));
      cy.wait(0.2 * baseTimeout);
      cy.get('body', { timeout: 5 * baseTimeout }).type('{leftarrow}');
    } else {
      // cy.get(".stimulus").should("be.visible");
      cy.wait(0.2 * baseTimeout);
      cy.get('body', { timeout: 5 * baseTimeout }).type('{rightarrow}');
      finishSWR(block_termination_phrase);
    }
  });
}
