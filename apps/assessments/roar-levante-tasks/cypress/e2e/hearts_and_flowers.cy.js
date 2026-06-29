const hearts_and_flowers_url = 'http://localhost:8000/?task=hearts-and-flowers';
const hearts_and_flowers_v2_url = 'http://localhost:8000/?task=hearts-and-flowers&version=2';

// keep track of game phase (true means it has started)
let heart_phase = false;
let flower_phase = false;
let mixed_practice = false;
let final_instructions = false; // instructions before final mixed test phase
let mixed_test = false;

describe('test hearts and flowers', () => {
  beforeEach(() => {
    heart_phase = false;
    flower_phase = false;
    mixed_practice = false;
    final_instructions = false;
    mixed_test = false;
  });

  it('visits hearts and flowers and plays game', () => {
    cy.visit(hearts_and_flowers_url);

    // wait for OK button to appear
    cy.contains('OK', { timeout: 300000 }).should('be.visible');
    cy.contains('OK').realClick(); // start fullscreen

    hafLoop();
  });

  it('visits hearts and flowers v2 and plays game', () => {
    cy.visit(hearts_and_flowers_v2_url);

    cy.contains('OK', { timeout: 300000 }).should('be.visible');
    cy.contains('OK').realClick(); // start fullscreen

    hafLoop(true);
  });
});

function hafLoop(isV2 = false) {
  // end if the there are no elements inside jspsych content
  cy.get('.jspsych-content').then((content) => {
    if (content.children().length) {
      // wait for feedback screen to go away
      cy.get('.haf-cr-container').should('not.exist');

      // Make the decision here to handle instructions or pick an answer
      if (isInstructionScreen(content, isV2)) {
        handleInstructions(isV2);
      } else {
        pickAnswer(isV2);
      }
      hafLoop(isV2);
    } else {
      // make sure that the game has progressed through major phases before passing
      assert.isTrue(heart_phase && flower_phase && mixed_test);
    }
  });
}

function isInstructionScreen(content, isV2) {
  if (content.find('.primary:visible').length) {
    return true;
  }

  if (!isV2) {
    return false;
  }

  return content.find('#instruction-text').length > 0 && !content.find('.haf-stimulus-holder').length;
}

function handleInstructions(isV2 = false) {
  cy.get('.jspsych-content').then((content) => {
    const okButton = content.find('.primary:visible');

    if (okButton.length) {
      cy.contains('OK').realClick();
      final_instructions = mixed_practice;
      return;
    }

    if (!isV2) {
      return;
    }

    if (content.find('#instruction-text').length && content.find('.lev-response-row').length) {
      handleV2ResponseButtonDemo();
      return;
    }

    continueV2Instruction();
    final_instructions = mixed_practice;
  });

  return;
}

function handleV2ResponseButtonDemo() {
  cy.get('.lev-response-row .secondary--green', { timeout: 120000 })
    .filter(':not([style*="visibility: hidden"])')
    .first()
    .should(($button) => {
      expect($button[0].style.animation).to.include('pulse');
    })
    .then(($button) => {
      cy.get('.lev-response-row .secondary--green').then(($buttons) => {
        const visibleIndex = [...$buttons].findIndex(
          (button) => button.style.visibility !== 'hidden' && !button.disabled,
        );

        cy.get('body').then(($body) => {
          if ($body.find('.arrow-key-border').length) {
            cy.realPress(visibleIndex === 0 ? 'ArrowLeft' : 'ArrowRight');
          } else {
            cy.wrap($button).realClick();
          }
        });
      });
    });

  // instruction demo trials wait before advancing
  cy.wait(2500);
}

function continueV2Instruction(retryCount = 0) {
  if (retryCount > 30) {
    throw new Error('Failed to advance v2 instruction trial');
  }

  cy.get('.jspsych-content').then(($content) => {
    if (!$content.find('#instruction-text').length) {
      return;
    }

    const instructionText = $content.find('#instruction-text').text();

    cy.wait(3000);
    cy.realPress(' ');
    cy.wait(1000);

    cy.get('.jspsych-content').then(($nextContent) => {
      const stillOnSameTrial =
        $nextContent.find('#instruction-text').length &&
        $nextContent.find('#instruction-text').text() === instructionText &&
        !$nextContent.find('.haf-stimulus-holder').length;

      if (stillOnSameTrial) {
        continueV2Instruction(retryCount + 1);
      }
    });
  });
}

function pickAnswer(isV2 = false) {
  // wait for feedback screen to end
  cy.get('.haf-stimulus-holder').should('exist');

  cy.get('.jspsych-content').then((content) => {
    const stimContainer = content.find('.haf-stimulus-container');

    if (stimContainer.length) {
      // check for presence of stimulus on left side
      const leftStim = stimContainer.find('.stimulus-left');

      // get position of stimulus based on whether leftStim exists
      const pos = leftStim.length ? 0 : 1;

      // get stimulus image itself and then click button based on src and pos
      cy.get('[alt="heart or flower"]')
        .invoke('attr', 'src')
        .then((src) => {
          if (isV2) {
            // press the correct arrow key
            const index = getCorrectButtonIdx(src, pos);
            cy.realPress(index === 0 ? 'ArrowLeft' : 'ArrowRight');
          } else {
            // click the correct button
            cy.get('.secondary--green').eq(getCorrectButtonIdx(src, pos)).realClick();
          }
        });
    }
  });

  return;
}

// uses image src and image position to get the right button index
function getCorrectButtonIdx(src, pos) {
  const shape = src.split('/').pop().split('.')[0];

  if (shape === 'heart') {
    heart_phase = true;
    mixed_practice = flower_phase;
    mixed_test = final_instructions;

    return pos;
  } else if (shape === 'flower') {
    flower_phase = true;

    if (pos === 1) {
      return 0;
    } else if (pos === 0) {
      return 1;
    }
  }
}
