import { playFluency } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';

const timeout = Cypress.env('timeout');
const administration = Cypress.env('testSpanishRoarAppsAdministration');
const endText = 'Has terminado.';
const continueText = 'continuar';

describe('Test playthrough of Fluency ARF ES as a participant', () => {
  it('Fluency Playthrough Test', () => {
    Cypress.on('uncaught:exception', () => {
      return false;
    });

    cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
    cy.visit('/');

    cy.selectAdministration(administration);

    cy.get('.p-tabview').contains('ROAM - Varios Dígitos');
    cy.visit(`/game/fluency-calf-es`);

    //   Click jspsych button to begin
    cy.get('.jspsych-btn', { timeout: 5 * timeout })
      .should('be.visible')
      .click();

    playFluency(endText, continueText);

    //  Check if game is marked as complete on the dashboard
    cy.visit('/');
    cy.wait(0.2 * timeout);
    cy.selectAdministration(administration);
    cy.get('.tabview-nav-link-label').contains('ROAM - Varios Dígitos').should('exist');
  });
});
