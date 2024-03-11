import { playSWRGame } from '../../../../support/helper-functions/roar-swr/swrHelpers';

const timeout = Cypress.env('timeout');

describe('Testing playthrough of SWR as a participant under a 2G Mobile connection or similar network of low bandwidth.', () => {
  it('ROAR-Word Playthrough Test', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));

    // Add wait time to simulate a slow network connection
    cy.wait(0.5 * timeout);
    cy.visit('/');

    cy.selectAdministration(Cypress.env('testRoarAppsAdministration'));

    cy.get('.p-tabview').contains('ROAR - Word');
    cy.visit(`/game/swr`);

    cy.get('.jspsych-btn', { timeout: 3 * timeout })
      .should('be.visible')
      .click();

    // handles error where full screen throws a permissions error
    cy.wait(0.1 * timeout);
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    playSWRGame();
  });
});
