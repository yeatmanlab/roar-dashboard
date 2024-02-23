import { playPA } from '../../support/helperFunctions/roar-pa/paHelpers';

const timeout = Cypress.env('timeout');
const startText = 'In this game we are going to look for words that BEGIN with the same sound.';
const endBlockText = {
  endText1: "Let's go help my friends now!",
  endText2: 'We have one last friend to help!',
  endText3: 'You have helped me and all my friends!',
};
const breakBlockText = {
  breakText1: "Great job! So many bananas! Let's get a few more!",
  breakText2: 'Look at all those carrots!',
  breakText3: "You are doing great! I am almost ready to go out and swim! Let's get a few more crabs.",
};

describe('Testing playthrough of ROAR-Phoneme as a participant', () => {
  it(`ROAR-Phoneme Playthrough Test`, () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));

    // cy.get(".p-tabview").contains(pa.name);
    cy.visit('/game/pa');

    playPA(startText, endBlockText, breakBlockText);

    cy.visit('/');
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
    cy.get('.tabview-nav-link-label', { timeout: 2 * timeout })
      .contains('ROAR-Phoneme')
      .should('have.attr', 'data-game-status', 'complete');
  });
});
