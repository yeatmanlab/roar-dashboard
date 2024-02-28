import { playSWRGame } from '../../../support/helperFunctions/roar-swr/swrHelpers';

const timeout = Cypress.env('timeout');

describe('Testing playthrough of SWR as a participant', () => {
  it('ROAR-Word Playthrough Test', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.get('.p-dropdown-trigger', { timeout: timeout }).should('be.visible').click();
    cy.get('.p-dropdown-item', { timeout: timeout })
      .contains(Cypress.env('testRoarAppsAdministration'))
      .should('be.visible')
      .click();

    cy.get('.p-tabview').contains('ROAR-Word');
    cy.visit(`/game/swr`);

    cy.get('.jspsych-btn', { timeout: timeout }).should('be.visible').click();

    // handles error where full screen throws a permissions error
    cy.wait(0.1 * timeout);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    playSWRGame();
  });
});
