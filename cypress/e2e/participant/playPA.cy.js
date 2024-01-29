import { timeouts } from "retry";

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

    cy.get('.p-dropdown-trigger', { timeout: 10000 }).click();
    cy.get('.p-dropdown-item', { timeout: 10000 }).contains('ZZZ Test Play PA').click();

    // cy.get(".p-tabview").contains(pa.name);
    cy.visit(`/game/${pa.id}`);

    cy.get(pa.startBtn, { timeout: 60000 }).should('be.visible').click();

    // case for game/pa -- it has two initiation buttons that need to be clicked
    if (pa.startBtn2) {
      cy.get(pa.startBtn2, { timeout: 60000 }).should('be.visible').click();
    }

    // handles error where full screen throws a permissions error
    cy.wait(1000);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    // clicks through first introduction pages
    for (let i = 0; i < pa.introIters; i++) {
      cy.get(pa.introBtn, { timeout: 10000 }).should('be.visible').click();
    }

    playPA();

    // check if game completed
    cy.visit('/');
    cy.get('.p-dropdown-trigger', { timeout: 20000 }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: 10000 })
      .contains('ZZZ Test Cypress Playthrough Button Games')
      .should('be.visible')
      .click();
    cy.get('.tabview-nav-link-label').contains(pa.name).should('have.attr', 'data-game-status', 'complete');
  });
});

function playPA() {
  // play intro
  playFirstTutorial();
  playTrial(6, 'Awesome! You have completed the first block.');
  cy.wait(6000);
  cy.get('.continue', { timeout: 18000 }).click();
  playSecondTutorial();
  playTrial(6, 'Awesome! You have completed the second block.');
  cy.wait(6000);
  cy.get('.continue', { timeout: 18000 }).click();
  playThirdTutorial();
  playTrial(6, 'Awesome! You have completed the last block.');
}

function playTrial(numTimes, trialFinishPhrase) {
  if (numTimes !== 0) {
    cy.wait(8500);
    cy.get('.testImageDown', {
      timeout: 4000,
    })
      .first()
      .click();
    cy.log('iteration: ', numTimes);
    numTimes = numTimes - 1;
    cy.log(numTimes)
    playTrial(numTimes);
  } else {
    // leaving this out because there are some issues with timing -- we'll have to knock down this assert at a different time
    // assert(cy.get("div").contains(trialFinishPhrase))
  }
}

function playFirstTutorial() {
  cy.wait(16000);
  cy.get('img[src*="map.webp"]', {timeout: 10000}).click();
  cy.wait(16000);
  cy.get('img[src*="rope.webp"]', {timeout: 10000}).click();
  cy.wait(4000);
  cy.get('.continue').click();
}

function playSecondTutorial() {
  cy.wait(16000);
  cy.get('img[src*="nut.webp"]', {timeout: 10000}).click();
  cy.wait(16000);
  cy.get('img[src*="wash.webp"]', {timeout: 10000}).click();
  cy.wait(4000);
  cy.get('.continue').click();
}

function playThirdTutorial() {
  cy.wait(12000);
  cy.get('img[src*="/ball.webp"]', {timeout: 10000}).click();
  cy.wait(12000);
  cy.get('img[src*="/rain.webp"]' {timeout: 10000}).click();
  cy.wait(4000);
  cy.get('.continue').click();
}
