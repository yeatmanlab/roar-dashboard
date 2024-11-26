import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

function clickButton(selector) {
  cy.get(selector).then(($btn) => {
    if ($btn.length > 0) {
      $btn.click();
    }
  });
}

function checkGameTab(language, task) {
<<<<<<< HEAD
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
=======
  cy.get('.p-tabview').contains(languageOptions[language][task].gameTab).should('exist');
>>>>>>> ff30ee22 (Remove arbitrary timeout overrides)
}

function clickThroughInstructions() {
  clickButton('.primary');
  clickButton('.primary');
  clickButton('.primary');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(1);
  cy.get('body').then((body) => {
    const text = body.text().replace(/\s\s+/g, ' ').trim();
    cy.log(`Found text: ${text}`);
    if (text.includes(gameCompleteText)) {
      cy.log('Game is complete.').then(() => true);
    } else {
      if (body.find('.go-button').length > 0) {
        clickButton('.go-button');
      } else if (body.find('.glowingButton').length > 0) {
        clickButton('.glowingButton');
      } else {
        clickButton('button');
      }
      cy.log('Making choice or continuing.');
      makeChoiceOrContinue(gameCompleteText);
    }
  });
}

function startGame(administration, language, optional, task, auth) {
  Cypress.on('uncaught:exception', () => false);

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

  checkGameTab(language, task);
  cy.visit(languageOptions[language][task].url);

  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(0.1 * Cypress.env('timeout'));
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.get('.primary').should('be.visible').click();
}

export function playSyntax({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  task = 'syntax',
  gameCompleteText = "You've completed the game",
  auth = 'username',
} = {}) {
  startGame(administration, language, optional, task, auth);

  clickThroughInstructions();

  makeChoiceOrContinue(gameCompleteText);

  cy.log('Game finished successfully.');

  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language, task);
  cy.log('Test completed successfully.');
}
