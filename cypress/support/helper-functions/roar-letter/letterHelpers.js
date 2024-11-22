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

function checkGameTab(language) {
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(0.2 * timeout);
  cy.get('body').then((body) => {
    const text = body.text().replace(/\s\s+/g, ' ').trim();
    cy.log('Found text: ', text);
    if (text.includes(gameCompleteText)) {
      cy.log('Game is complete.').then(() => true);
    } else {
      if (body.find('.go-button').length > 0) {
        clickButton('.go-button');
      } else if (body.find('.glowingButton').length > 0) {
        clickButton('.glowingButton');
      } else {
        clickButton('button:first');
      }
      cy.log('Making choice or continuing.');
      makeChoiceOrContinue(gameCompleteText);
    }
  });
}

export function startGame(administration, language, optional, auth) {
  Cypress.on('uncaught:exception', () => false);
  cy.visit('/', { timeout: 2 * timeout });
  if (auth === 'username') {
    cy.login(Cypress.env('PARTICIPANT_USERNAME'), Cypress.env('PARTICIPANT_PASSWORD'));
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

  checkGameTab(language);
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn', { timeout: 18 * timeout })
    .should('be.visible')
    .click();

  cy.wait(0.1 * timeout);
  Cypress.on('uncaught:exception', () => {
    return false;
  });

  cy.get('.go-button', { timeout: timeout }).should('be.visible').click();
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
  cy.wait(0.2 * timeout);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language);
  cy.log('Test completed successfully.');
}
