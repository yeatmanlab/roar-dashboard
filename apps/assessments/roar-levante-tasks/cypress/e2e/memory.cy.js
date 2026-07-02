const memory_game_url = 'http://localhost:8000/?task=memory-game';

describe('test memory game', () => {
  it('visits memory game and plays it', () => {
    cy.visit(memory_game_url);

    // wait for OK button to appear
    cy.contains('OK', { timeout: 300000 }).should('be.visible');
    cy.contains('OK').realClick(); // start fullscreen

    cy.get('p').then(() => {
      memoryLoop();
    });

    cy.contains('Exit').click();
  });
});

function handleInstructions() {
  cy.get('.jspsych-content').then((content) => {
    const corsiBlocks = content.find('.jspsych-corsi-block');

    if (corsiBlocks.length === 0) {
      cy.contains('OK').click();
    }
  });
  return;
}

function answerTrial() {
  // wait for gap after display phase
  cy.get('p', { timeout: 20000 }).should('not.exist');
  cy.get('p').should('exist');

  cy.get('.jspsych-content').then((content) => {
    const blocks = content.find('.jspsych-corsi-block');

    if (blocks.length > 0) {
      // wait for window to contain sequence information
      cy.window().its('cypressData').should('have.property', 'correctAnswer');

      cy.window().then((window) => {
        const sequence = window.cypressData.correctAnswer;
        sequence.forEach((number) => {
          blocks[number].click();
        });
        cy.get('p').should('not.exist', { timeout: 5000 });
      });
    }
  });
  return;
}

function memoryLoop() {
  cy.get('.jspsych-content').then((content) => {
    const corsiBlocks = content.find('.jspsych-corsi-block');

    if (corsiBlocks.length > 0) {
      answerTrial();
    } else {
      handleInstructions();
    }
  });

  // end recursion if the task has reached the end screen
  cy.get('p,h1').then((p) => {
    if (p[0].textContent.includes('Thank you!')) {
      return;
    } else {
      memoryLoop();
    }
  });
}
