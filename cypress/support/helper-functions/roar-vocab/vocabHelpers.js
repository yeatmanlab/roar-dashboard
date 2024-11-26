import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

function checkGameTab(language) {
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(1);
  cy.get('body').then((body) => {
    //   If a go button is found, click it and then return to playMultichoice loop
    if (body.find('.continue').length > 0) {
      cy.get('body')
        .invoke('text')
        .then((text) => {
          // Check for the game completion text
          if (text.includes(gameCompleteText)) {
            cy.log('Game completed.');
            cy.get('.continue').click();
          } else {
            // If the game is not complete, click the continue button
            cy.log('Game not completed.');
            cy.get('.continue').click();
            makeChoiceOrContinue(gameCompleteText);
          }
        });
    } else {
      // If no continue button is found, check for choices to make
      cy.get(body).then(($el) => {
        if ($el.find('img.vocab_img').length > 0) {
          // If choices are found, click the first choice and return to playMultichoice loop
          cy.get('img.vocab_img').first().click();
          makeChoiceOrContinue(gameCompleteText);
        } else {
          // If no choices are found, the game is complete
          cy.log('No more choices to make, game completed.');
        }
      });
    }
  });
}
function selectAlienAvatar() {
  cy.get('img.intro_aliens').should('be.visible').first().click();
}

function startGame(administration, language, optional, auth) {
  cy.wait(0.1 * Cypress.env('timeout'));
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

  checkGameTab(language);
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn').should('be.visible').click();

  selectAlienAvatar();
}

export function playVocabulary({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  gameCompleteText = 'We’ve all learned so much!',
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
