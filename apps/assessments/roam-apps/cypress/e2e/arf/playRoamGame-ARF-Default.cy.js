import { playRoamGame } from '../../support/roamHelpers';

const timeout = Cypress.env('timeout');
const endText = 'You are all done.';

describe('Test play through of ARF as a participant', () => {
  it.skip('ARF Play through Test', () => {
    Cypress.on('uncaught:exception', () => false);

    cy.visit('/');

    //   Click jspsych button to begin
    cy.get('.jspsych-btn', { timeout: 5 * timeout })
      .should('be.visible')
      .click();

    playRoamGame(endText);
  });
});
