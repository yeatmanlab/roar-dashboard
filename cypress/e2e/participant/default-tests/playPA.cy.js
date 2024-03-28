import { playPA } from '../../../support/helper-functions/roar-pa/paHelpers';

const timeout = Cypress.env('timeout');
const startText = 'In this game we are going to look for words that BEGIN with the same sound.';
const endBlockText = {
  endText1: 'Take a break if needed',
  endText2: 'I have been swimming so much',
  endText3: 'You have helped me and all my friends!',
};
const breakBlockText = 'Take a break if needed';

describe('Testing playthrough of ROAR-Phoneme as a participant', () => {
  it(`ROAR-Phoneme Playthrough Test`, () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));

    // cy.get(".p-tabview").contains(pa.name);
    cy.visit('/game/pa');

    playPA(startText, breakBlockText, endBlockText);

    cy.visit('/');
    cy.wait(0.2 * timeout);
    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));
    cy.get('.tabview-nav-link-label', { timeout: 3 * timeout })
      .contains('ROAR - Phoneme')
      .should('exist');
  });
});
