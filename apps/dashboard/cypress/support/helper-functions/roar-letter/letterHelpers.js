import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

function clickButton(selector) {
  return cy.get(selector).then(($btn) => {
    const foundButton = $btn.length > 0;
    if (foundButton) {
      $btn.click();
    }
    return foundButton;
  });
}

const timeout = Cypress.env('timeout');

function checkGameTab(language) {
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(1);
  cy.get('body').then((body) => {
    const text = body.text().replace(/\s\s+/g, ' ').trim();
    cy.log('Found text: ', text);
    if (text.includes(gameCompleteText)) {
      cy.log('Game is complete.').then(() => true);
    } else {
      // Use cy.get() instead of body.find() to grab the .go-button element.
      // If it is found, then click it.
      clickButton('go-button')
        .then((foundGoButton) => {
          if (!foundGoButton) {
            // Fall back to the glowing button if the go button is not found.
            return clickButton('glowingButton');
          }
          return foundGoButton;
        })
        .then((foundPreviousButton) => {
          if (!foundPreviousButton) {
            return clickButton('button:first');
          }
          return foundPreviousButton;
        });

      cy.log('Making choice or continuing.');
      makeChoiceOrContinue(gameCompleteText);
    }
  });
}

export function startGame(administration, language, optional, auth) {
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

  checkGameTab(language);
  cy.visit(languageOptions[language].url);

  cy.waitForAssessmentReadyState();
  cy.get('.jspsych-btn').should('be.visible').click();

  cy.wait(0.1 * Cypress.env('timeout'));
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.get('.go-button').should('be.visible').click();
}

export function playLetter({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  gameCompleteText = 'Congratulations',
  optional = false,
  auth = 'username',
} = {}) {
  startGame(administration, language, optional, auth);

  makeChoiceOrContinue(gameCompleteText);
  cy.log('Game finished successfully.');

  cy.visit('/');
  cy.wait(1);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language);
  cy.log('Test completed successfully.');
}
