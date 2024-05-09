import { playFluency } from '../../../../support/helper-functions/roam-fluency/fluencyHelpers';
const chokidar = require('chokidar');

// Specify the path to package.json
const packageJsonPath = 'package.json';

// Initialize chokidar watcher
const packageJsonWatcher = chokidar.watch(packageJsonPath);

// Add event listener for 'change' event
packageJsonWatcher.on('change', () => {
  console.log(`package.json has been updated`);
  testROAMFluency();
});

// Example test function
function testROAMFluency() {
  const timeout = Cypress.env('timeout');
  const administration = Cypress.env('testSpanishRoarAppsAdministration');
  const endText = 'Has terminado.';

  describe('Test playthrough of Fluency ARF ES as a participant', () => {
    it('Fluency Playthrough Test', () => {
      Cypress.on('uncaught:exception', () => {
        return false;
      });

      cy.login(Cypress.env('participantUsername'), Cypress.env('participantPassword'));
      cy.visit('/');

      cy.selectAdministration(administration);

      cy.get('.p-tabview').contains('ROAM - Un Dígito');
      cy.visit(`/game/fluency-arf-es`);

      //   Click jspsych button to begin
      cy.get('.jspsych-btn', { timeout: 5 * timeout })
        .should('be.visible')
        .click();

      playFluency(endText);

      //  Check if game is marked as complete on the dashboard
      cy.visit('/');
      cy.wait(0.2 * timeout);
      cy.selectAdministration(administration);
      cy.get('.tabview-nav-link-label').contains('ROAM - Un Dígito').should('exist');
    });
  });
}
