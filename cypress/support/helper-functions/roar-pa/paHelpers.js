import { languageOptions } from './languageOptions';

const CLEVER_SCHOOL_NAME = Cypress.env('CLEVER_SCHOOL_NAME');
const CLEVER_USERNAME = Cypress.env('CLEVER_USERNAME');
const CLEVER_PASSWORD = Cypress.env('CLEVER_PASSWORD');
const PARTICIPANT_USERNAME = Cypress.env('PARTICIPANT_USERNAME');
const PARTICIPANT_PASSWORD = Cypress.env('PARTICIPANT_PASSWORD');

export const timeout = Cypress.env('timeout');

function handleFullScreenError() {
  Cypress.on('uncaught:exception', () => {
    return false;
  });
}

function checkGameTab(language) {
  cy.get('.p-tablist-tab-list', { timeout: timeout }).contains(languageOptions[language].gameTab).should('exist');
}

const playTrial = (targetText) => {
  // Recursively check for the end block text to appear;
  // Long wait time needed for asset loading
  cy.wait(1.5 * timeout);

  // Check for a re-route to the dashboard or for the end block text
  cy.get('body', { timeout: timeout })
    .invoke('text')
    .then((text) => {
      cy.log('target', text, 'targetext', targetText);
      //   Check for re-route to dashboard from game and assume game complete
      if (text.includes('Sign Out')) {
        cy.log('Rerouted to dashboard from game; game complete.');
      } else {
        // Check for the end block text
        if (text.includes(targetText)) {
          cy.get('div', { timeout: timeout }).contains(targetText, { timeout: timeout }).should('be.visible');
          cy.log('Game break.');
        } else {
          // Check session storage for the correct answer and select it
          cy.window().then((win) => {
            const correctAnswer = JSON.parse(win.sessionStorage.getItem('currentStimulus')).goal;
            cy.log(correctAnswer);

            cy.log('Game in progress; selecting correct answer.');
            // eslint-disable-next-line cypress/unsafe-to-chain-command
            cy.get(`img[src*="${correctAnswer}.webp"]`, { timeout: timeout }).then((exists) => {
              if (exists) {
                cy.get(`img[src*="${correctAnswer}.webp"]`, { timeout: timeout }).first().click();
                cy.wait(0.05 * timeout);
              } else {
                // If the correct answer is not found, assume the game is complete (white screen)
                cy.log('No correct answer found; game complete..');
              }
            });

            // Check progress bar status
            cy.get('#jspsych-progressbar-inner', { timeout: timeout })
              .invoke('attr', 'style')
              .then((style) => {
                // If the progress bar is at 100%, the game is complete
                if (style && style.includes('width: 100%')) {
                  cy.log('Game complete.');
                } else {
                  playTrial(targetText); // Recursive call
                }
              });
          });
        }
      }
    });
};

function playIntro(startText) {
  cy.get('.instructionCanvasNS', { timeout: 12 * timeout })
    .should('be.visible')
    .click();

  cy.get('.jspsych-btn', { timeout: 12 * timeout })
    .should('be.visible')
    .click();

  cy.get('.continue', { timeout: 12 * timeout })
    .should('be.visible')
    .click();

  handleFullScreenError();

  cy.get('div', { timeout: timeout })
    .contains(startText, { timeout: 2 * timeout })
    .should('be.visible');
  cy.get('.continue', { timeout: 2 * timeout })
    .should('be.visible')
    .click();
}

function playFirstTutorial(imageOne, imageTwo) {
  cy.wait(timeout);
  cy.get(`img[src="${imageOne}"]`, { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get(`img[src="${imageTwo}"]`, { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playSecondTutorial(imageOne, imageTwo) {
  cy.wait(timeout);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(2 * timeout);
  cy.get(`img[src="${imageOne}"]`, { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get(`img[src="${imageTwo}"]`, { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playThirdTutorial(imageOne, imageTwo) {
  cy.wait(timeout);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(2 * timeout);
  cy.get(`img[src="${imageOne}"]`, { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get(`img[src="${imageTwo}"]`, { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('.continue').click();
}

export function playPA({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  startText = languageOptions[language].startText,
  breakText = languageOptions[language].breakText,
  breakText2 = {
    break1: languageOptions[language].breakText2.break1,
    break2: languageOptions[language].breakText2.break2,
    break3: languageOptions[language].breakText2.break3,
  },
  endText = {
    endText1: languageOptions[language].endText.endText1,
    endText2: languageOptions[language].endText.endText2,
    endText3: languageOptions[language].endText.endText3,
  },
  auth = 'username',
} = {}) {
  cy.visit('/');

  if (auth === 'clever') {
    cy.loginWithClever(CLEVER_SCHOOL_NAME, CLEVER_USERNAME, CLEVER_PASSWORD);
  }

  if (auth === 'username') {
    cy.login(PARTICIPANT_USERNAME, PARTICIPANT_PASSWORD);
    cy.visit('/');
  }

  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  checkGameTab(language);
  cy.visit(languageOptions[language].url);

  playIntro(startText);

  const tutorialImages = [
    languageOptions[language].tutorialImage0,
    languageOptions[language].tutorialImage1,
    languageOptions[language].tutorialImage2,
    languageOptions[language].tutorialImage3,
    languageOptions[language].tutorialImage4,
    languageOptions[language].tutorialImage5,
  ];

  playFirstTutorial(tutorialImages[0], tutorialImages[1]);
  //  fsmBreak
  cy.log('break 1');
  playTrial(breakText2.break1);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(breakText);

  cy.wait(3 * timeout);
  cy.get('.continue', { timeout: 4 * timeout }).click();
  playSecondTutorial(tutorialImages[2], tutorialImages[3]);
  playTrial(breakText2.break2);
  cy.get('.continue', { timeout: 2 * timeout }).click();

  if (language === 'en') {
    playTrial(breakText);
  }
  if (language === 'es') {
    cy.log('In conditional es block');
    playTrial(endText.endText1);
    cy.log('Ending game.');
  }

  if (language === 'en') {
    //  lsmBreak, English only
    cy.wait(3 * timeout);
    cy.log('break 2');
    cy.get('.continue', { timeout: 2 * timeout }).click();
    playTrial(endText.endText2);

    cy.wait(3 * timeout);
    // Only run the third tutorial if the language is English
    cy.get('.continue', { timeout: 4 * timeout }).click();
    playThirdTutorial(tutorialImages[4], tutorialImages[5]);
    //  delBreak
    cy.log('break 3');
    playTrial(breakText2.break3);
    cy.get('.continue', { timeout: 2 * timeout }).click();
    playTrial(endText.endText3);
  }

  cy.log('Routing to dashboard.');
  cy.visit('/');
  cy.wait(0.2 * timeout);
  cy.selectAdministration(administration);

  if (optional === true) {
    cy.log('Switching to optional assessments.');
    cy.switchToOptionalAssessments();
  }

  cy.get('.tabview-nav-link-label', { timeout: 3 * timeout })
    .contains(languageOptions[language].gameTab)
    .should('exist');
}
