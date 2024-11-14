import { languageOptions } from './languageOptions';
import { signInWithClever } from '../participant/participant-helpers';

const timeout = Cypress.env('timeout');

function clickButton(selector) {
  cy.get(selector).then(($btn) => {
    if ($btn.length > 0) {
      $btn.click();
    }
  });
}

function checkGameTab(language, task) {
  cy.get('.p-tabview', { timeout: timeout }).contains(languageOptions[language][task].gameTab).should('exist');
}

function clickThroughInstructions() {
  clickButton('.primary');
  clickButton('.primary');
  clickButton('.primary');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(0.2 * timeout);
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

  cy.visit('/', { timeout: 2 * timeout });
  if (auth === 'username') {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/', { timeout: 2 * timeout });
  }
  if (auth === 'clever') {
    signInWithClever();
  }
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }
  checkGameTab(language, task);
  cy.visit(languageOptions[language][task].url);

  cy.get('.jspsych-btn', { timeout: 12 * timeout })
    .should('be.visible')
    .click();

  cy.wait(0.1 * timeout);
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.get('.primary', { timeout: timeout }).should('be.visible').click();
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
  cy.wait(0.2 * timeout);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language, task);
  cy.log('Test completed successfully.');
}
