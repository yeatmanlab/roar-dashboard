import { signInWithClever } from '../participant/participant-helpers';

export const timeout = Cypress.env('timeout');

function handleFullScreenError() {
  Cypress.on('uncaught:exception', () => {
    return false;
  });
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
            cy.get(`img[src*="${correctAnswer}.webp"]`, { timeout: timeout })
              .first()
              .click()
              .wait(0.05 * timeout);

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

function playFirstTutorial() {
  cy.wait(timeout);
  cy.get('img[src*="map.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="rope.webp"]', { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playSecondTutorial() {
  cy.wait(timeout);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="nut.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="wash.webp"]', { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playThirdTutorial() {
  cy.wait(timeout);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="/ball.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="/rain.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('.continue').click();
}

export function playPA({
  administration = Cypress.env('testRoarAppsAdministration'),
  language = 'en',
  optional = false,
  startText = 'In this game we are going to look for words that BEGIN with the same sound.',
  breakText = 'Take a break if needed',
  breakText2 = {
    break1: 'Great job',
    break2: 'Look at all those carrots',
    break3: 'You are doing great',
  },
  endText = {
    endText1: 'Take a break if needed',
    endText2: 'I have been swimming so much',
    endText3: 'You have helped me and all my friends!',
  },
  auth = 'username',
} = {}) {
  cy.visit('/');
  if (auth === 'clever') {
    signInWithClever();
  }
  if (auth === 'username') {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
  }

  cy.selectAdministration(administration);

  cy.visit('/game/pa');

  playIntro(startText);

  playFirstTutorial();
  //  fsmBreak
  cy.log('break 1');
  playTrial(breakText2.break1);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(breakText);

  cy.wait(3 * timeout);
  cy.get('.continue', { timeout: 4 * timeout }).click();
  playSecondTutorial('default');
  playTrial(breakText2.break2);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(breakText);
  //  lsmBreak
  cy.wait(3 * timeout);
  cy.log('break 2');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText.endText2);

  cy.wait(3 * timeout);
  cy.get('.continue', { timeout: 4 * timeout }).click();
  playThirdTutorial('default');
  //  delBreak
  cy.log('break 3');
  playTrial(breakText2.break3);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText.endText3);

  cy.visit('/');
  cy.wait(0.2 * timeout);
  cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
  cy.get('.tabview-nav-link-label', { timeout: 3 * timeout })
    .contains('ROAR - Phoneme')
    .should('exist');
}
