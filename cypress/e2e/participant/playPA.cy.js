const timeout = Cypress.env('timeout');

let pa = {
  name: 'ROAR-Phoneme',
  id: 'pa',
  startBtn: '.instructionCanvasNS',
  startBtn2: '.jspsych-btn',
  setUpChoice: '',
  introIters: 2,
  preAnswerDelay: 6000,
  introBtn: '.continue',
  clickableItem: '.jspsych-audio-button-response-button',
  correctChoice: '',
  numIter: 2,
};

describe('Testing playthrough of ROAR-Phoneme as a participant', () => {
  it(`${pa.name} Playthrough Test`, () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.get('.p-dropdown-trigger', { timeout: timeout }).click();
    cy.get('.p-dropdown-item', { timeout: timeout }).contains(Cypress.env('testRoarAppsAdministration')).click();

    // cy.get(".p-tabview").contains(pa.name);
    cy.visit(`/game/${pa.id}`);

    cy.get(pa.startBtn, { timeout: 5 * timeout })
      .should('be.visible')
      .click();

    // case for game/pa -- it has two initiation buttons that need to be clicked
    if (pa.startBtn2) {
      cy.get(pa.startBtn2, { timeout: 5 * timeout })
        .should('be.visible')
        .click();
    }

    // handles error where full screen throws a permissions error
    cy.wait(0.2 * timeout);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    // clicks through first introduction pages
    for (let i = 0; i < pa.introIters; i++) {
      cy.get(pa.introBtn, { timeout: timeout }).should('be.visible').click();
    }

    playPA();

    // check if game completed
    cy.visit('/');
    cy.get('.p-dropdown-trigger', { timeout: 2 * timeout })
      .should('be.visible')
      .click();
    cy.get('.p-dropdown-item', { timeout: timeout })
      .contains(Cypress.env('testRoarAppsAdministration'))
      .should('be.visible')
      .click();
    cy.get('.tabview-nav-link-label').contains(pa.name).should('have.attr', 'data-game-status', 'complete');
  });
});

function playPA() {
  // play intro
  playFirstTutorial();
  playTrial(10);
  //  fsmBreak
  cy.log('break 1');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(9);

  playSecondTutorial();
  playTrial(10);
  //  lsmBreak
  cy.log('break 2');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(9);

  playThirdTutorial();
  playTrial(10);
  //  delBreak
  cy.log('break 3');
  cy.get('.continue', { timeout: 2 * timeout }).click();
  playTrial(9);
}

function playTrial(numTimes, trialFinishPhrase) {
  if (numTimes !== 0) {
    cy.wait(timeout);
    cy.window().then((win) => {
      const correctAnswer = JSON.parse(win.sessionStorage.getItem('currentStimulus')).goal;
      cy.log(correctAnswer);

      cy.get(`img[src*="${correctAnswer}.webp"]`, {
        timeout: timeout,
      })
        .first()
        .click();
    });

    cy.log('iteration: ', numTimes);
    numTimes = numTimes - 1;
    cy.log(numTimes);
    playTrial(numTimes);
  } else {
    // leaving this out because there are some issues with timing -- we'll have to knock down this assert at a different time
    // assert(cy.get("div").contains(trialFinishPhrase))
  }
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
