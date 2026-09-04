const timeout = Cypress.env('timeout');
const gameCompleteText = 'Congratulations!';

/**
 * Drives the game forward one step. On each call:
 * 1. If the game-complete heading is visible → done, do nothing.
 * 2. If a break/go-button screen is showing → click it and recurse.
 * 3. Otherwise → click a trial answer button and recurse.
 *
 * Recursion is bounded by maxSteps to prevent infinite loops if the game
 * never reaches the end screen.
 */
function playStep(maxSteps) {
  if (maxSteps <= 0) return;

  cy.wait(0.2 * timeout);

  cy.get('body').then((body) => {
    if (body.find('h1').filter(`:contains("${gameCompleteText}")`).length > 0) {
      // Game is over — stop recursing.
      return;
    }

    if (body.find('.go-button').length > 0) {
      cy.get('.go-button').click();
    } else if (body.find('.glowingButton').length > 0) {
      cy.get('.glowingButton').click();
    } else {
      cy.get('button').first().click();
    }

    playStep(maxSteps - 1);
  });
}

describe('Test play through of ROAR-Letter as a participant', () => {
  it('Plays through ROAR-Letter', () => {
    Cypress.on('uncaught:exception', () => false);

    cy.visit(Cypress.env('baseUrl'));

    cy.get('.jspsych-btn', { timeout: 2 * timeout })
      .should('be.visible')
      .click();

    playStep(200);

    cy.log('Checking if game completed.');
    cy.get('h1').contains(gameCompleteText).should('be.visible');
  });
});
