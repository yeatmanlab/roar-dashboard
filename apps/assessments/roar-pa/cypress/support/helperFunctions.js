export const timeout = Cypress.env('timeout');

function handleFullScreenError() {
  // eslint-disable-next-line no-unused-vars
  Cypress.on('uncaught:exception', (err, runnable, promise) => false);
}

const playTrial = (targetText, isEnd = false) => {
  //  Recursively check for the end game text to appear;
  //   Long wait time needed for asset loading
  cy.wait(1.2 * timeout);
  cy.get('body', { timeout: timeout })
    .invoke('text')
    .then((text) => {
      cy.log('target', text, 'targetext', targetText, 'isEnd', isEnd);
      if (text.includes(targetText)) {
        cy.get('div', { timeout: timeout }).contains(targetText, { timeout: timeout }).should('be.visible');
        cy.log('Game break.');
      } else {
        cy.get('#jspsych-progressbar-inner', { timeout: timeout })
          .invoke('attr', 'style')
          .then((style) => {
            if (style && style.includes('width: 100%') && isEnd) {
              cy.log('Game complete.');
            } else {
              cy.log('Game in progress.');
              cy.window().then((win) => {
                const correctAnswer = JSON.parse(win.sessionStorage.getItem('currentStimulus')).goal;
                cy.log(correctAnswer);
                cy.get(`img[src*="${correctAnswer}.webp"]`, {
                  timeout: 5 * timeout,
                })
                  .first()
                  .click();
                playTrial(targetText, isEnd); // Recursive call
              });
            }
          });
      }
    });
};

function playIntro() {
  handleFullScreenError();

  cy.get('.instructionCanvasNS', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  cy.get('.jspsych-btn', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  cy.get('.continue', { timeout: 5 * timeout })
    .should('be.visible')
    .click();

  cy.get('.continue', { timeout: 5 * timeout })
    .should('be.visible')
    .click();
}

function playFirstTutorial() {
  cy.wait(2 * timeout);
  cy.get('img[src*="map.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="rope.webp"]', { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playSecondTutorial(mode) {
  if (mode === 'default') {
    cy.wait(2 * timeout);
    cy.get('.continue', { timeout: 2 * timeout }).click();
  }
  cy.wait(2 * timeout);
  cy.get('img[src*="nut.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="wash.webp"]', { timeout: timeout }).click();
  cy.wait(timeout);
  cy.get('.continue').click();
}

function playThirdTutorial(mode) {
  if (mode === 'default') {
    cy.wait(2 * timeout);
    cy.get('.continue', { timeout: 2 * timeout }).click();
  }
  cy.wait(2 * timeout);
  cy.get('img[src*="/ball.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('img[src*="/rain.webp"]', { timeout: timeout }).click();
  cy.wait(2 * timeout);
  cy.get('.continue').click();
}

export function playPA(startText, breakText, breakText2, endText) {
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
  playTrial(endText.endText3, true);
}

export function playPASO(breakText, breakText2, endText) {
  playIntro();

  playFirstTutorial();
  cy.log('break 1');
  playTrial(breakText);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(breakText2);

  cy.get('.continue', { timeout: 4 * timeout }).click();
  playSecondTutorial('storyOption');
  playTrial(breakText);
  cy.get('.continue', { timeout: 4 * timeout }).click();
  playTrial(breakText2);

  cy.log('break 2');
  cy.get('.continue', { timeout: 3 * timeout }).click();
  playThirdTutorial('storyOption');
  cy.log('break 3');
  playTrial(breakText);
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(endText, true);
}
