import { languageOptions } from './languageOptions';

const timeout = Cypress.env('timeout');

function checkGameTab(language) {
  cy.get('.p-tabview', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

function makeChoiceOrContinue(gameCompleteText) {
  cy.wait(0.2 * timeout);
  cy.get('body').then((body) => {
    //   If a go button is found, click it and then return to playMultichoice loop
    if (body.find('.continue').length > 0) {
      cy.get('body')
        .invoke('text')
        .then((text) => {
          if (text.includes(gameCompleteText)) {
            cy.log('Game completed.');
            cy.get('.continue').click();
          } else {
            cy.log('Game not completed.');
            cy.get('.continue').click();
            makeChoiceOrContinue(gameCompleteText);
          }
        });
    } else {
      cy.get('img.vocab_img').first().click();
      makeChoiceOrContinue(gameCompleteText);
    }
  });
}
function selectAlienAvatar() {
  cy.get('img.intro_aliens', { timeout: 2 * timeout })
    .should('be.visible')
    .first()
    .click();
}

function startGame(administration, language, optional) {
  cy.wait(0.1 * timeout);
  Cypress.on('uncaught:exception', () => {
    return false;
  });
  cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));

  cy.visit('/', { timeout: 2 * timeout });
  cy.selectAdministration(administration);

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language);
  cy.visit(languageOptions[language].url);

  cy.get('.jspsych-btn', { timeout: 6 * timeout })
    .should('be.visible')
    .click();

  selectAlienAvatar();
}

export function playVocabulary({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  gameCompleteText = 'We’ve all learned so much!',
  optional = false,
} = {}) {
  startGame(administration, language, optional);

  makeChoiceOrContinue(gameCompleteText);

  cy.log('Game finished successfully.');

  cy.visit('/');
  cy.wait(0.2 * timeout);
  cy.selectAdministration(administration);

  if (optional) {
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language);
  cy.log('Test completed successfully.');
}
