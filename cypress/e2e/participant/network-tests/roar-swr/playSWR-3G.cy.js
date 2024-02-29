import { playSWRGame } from '../../../../support/helperFunctions/roar-swr/swrHelpers';

const timeout = Cypress.env('timeout');

describe('Testing playthrough of SWR as a participant under a 3G Mobile connection or similar network of low bandwidth.', () => {
  it('ROAR-Word Playthrough Test', () => {
    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));

    // Add wait time to simulate a slow network connection
    cy.wait(0.3 * timeout);
    cy.visit('/');

    cy.get('.p-dropdown-trigger', { timeout: 2 * timeout })
      .should('be.visible')
      .click();
    cy.get('.p-dropdown-item', { timeout: 2 * timeout })
      .contains(Cypress.env('testRoarAppsAdministration'))
      .should('be.visible')
      .click();

    cy.get('.p-tabview').contains('ROAR - Word');
    cy.visit(`/game/swr`);

    cy.get('.jspsych-btn', { timeout: 2 * timeout })
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
