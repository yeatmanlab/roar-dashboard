const timeout = Cypress.env('timeout');
// 7 intro iterations plus 21 stimulus block iterations
const variantIterations = 16;
const gameCompleteText = 'Congratulations!';

function makeChoiceOrContinue(overflow, iterations) {
  cy.wait(0.2 * timeout);
  cy.get('body').then((body) => {
    //   If a go button is found, click it and then return to playMultichoice loop
    if (body.find('.go-button').length > 0) {
      //   On the last iteration, check if the game is completed
      if (iterations === variantIterations - 1) {
        cy.log('Checking if game completed.');
        cy.get('h1').contains(gameCompleteText).should('be.visible');
      }
      cy.get('.go-button').click();
    } else {
      //   Only enters this else-block if a go button was not pressed
      if (body.find('.glowingButton').length > 0) {
        cy.get('.glowingButton').click();
      } else {
        cy.get('button').first().click();
      }
      // Either presses the glowing button during the tutorial or presses the first button of the stimulus trials, then iterates the overflow
      if (overflow < 100) {
        makeChoiceOrContinue(overflow + 1, iterations);
      }
    }
  });
}

function playLetter(iterations) {
  // overflow prevents recursive call from recursing forever
  const overflow = 0;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < iterations; i++) {
    cy.log('iteration: ', i);
    makeChoiceOrContinue(overflow, i);
  }
}

describe('Test play through of ROAR-Letter as a participant', () => {
  it('Plays through ROAR-Letter', () => {
    Cypress.on('uncaught:exception', () => false);

    cy.visit(Cypress.env('baseUrl'));

    cy.get('.jspsych-btn', { timeout: 2 * timeout })
      .should('be.visible')
      .click();

    playLetter(variantIterations);
  });
});
