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
  cy.get('.instructionCanvasNS', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  cy.get('.jspsych-btn', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  cy.get('.continue', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  handleFullScreenError();

  cy.get('div', { timeout: timeout }).contains(startText, { timeout: timeout }).should('be.visible');
  cy.get('.continue', { timeout: timeout }).should('be.visible').click();

  // clicks through first introduction pages
  // eslint-disable-next-line no-plusplus
  // for (let i = 0; i < 2; i++) {
  //   cy.get(".continue", { timeout: timeout }).should('be.visible').click();
  // }
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
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(timeout);
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
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.get('.continue', { timeout: 2 * timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="/ball.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="/rain.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('.continue').click();
}

export function playPA(startText, endText, breakText) {
  playIntro(startText);

  playFirstTutorial();
  playTrial(breakText.breakText1);
  //  fsmBreak
  cy.log('break 1');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText.endText1);

  playSecondTutorial();
  playTrial(breakText.breakText2);
  //  lsmBreak
  cy.log('break 2');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText.endText2);

  playThirdTutorial();
  playTrial(breakText.breakText3);
  //  delBreak
  cy.log('break 3');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText.endText3);
}
