let taskCompleted = false;
// recursively completes an instruction block
export function instructions() {
  cy.get('.jspsych-content').then((content) => {
    const okButton = content.find('.primary');

    if (okButton.length > 0) {
      // check for end of task
      cy.get('.lev-stimulus-container').then((content) => {
        if (content.find('footer').length === 1) {
          cy.contains('Exit').click({ timeout: 60000 });
          taskCompleted = true;
          return;
        } else {
          cy.get('.primary').click({ timeout: 60000 });
          instructions();
        }
      });
    }
  });
}

// clicks correct answers
function selectAnswers(correctFlag, buttonClass) {
  cy.get('.jspsych-content').then((content) => {
    const responseButtons = content.find(buttonClass);

    if (responseButtons.length > 1) {
      if (correctFlag === 'alt') {
        cy.get('[aria-label="correct"]')
          .should('be.visible')
          .and('not.be.disabled')
          .click({ force: true, timeout: 30000 }); // add timeout to handle staggered buttons
      } else if (correctFlag === 'none') {
        // for tasks that don't have correct answers
        cy.get(buttonClass).first().click({ force: true, timeout: 30000 });
      } else {
        // use correct class by default
        cy.get('.correct').click({ timeout: 60000 }); // add timeout to handle staggered buttons
      }
    } else {
      return;
    }
  });
}

function handleMathSlider() {
  cy.get('.jspsych-content').then((content) => {
    const slider = content.find('.jspsych-slider');
    const responseButtons = content.find('.secondary'); // should be length zero if in the movable slider phase

    if (slider.length && !responseButtons.length) {
      cy.get('.jspsych-slider').realClick();

      cy.get('.primary').then((continueButton) => {
        continueButton.click();
      });
    }
  });

  return;
}

function taskLoop(correctFlag, buttonClass) {
  // wait for fixation cross to go away
  cy.get('.lev-stimulus-container', { timeout: 60000 }).should('exist');

  handleMathSlider();
  selectAnswers(correctFlag, buttonClass);
  instructions();

  cy.get('.lev-stimulus-container', { timeout: 60000 })
    .should('not.exist')
    .then(() => {
      if (taskCompleted) {
        return;
      } else {
        taskLoop(correctFlag, buttonClass);
      }
    });
}

export function testAfc(correctFlag, buttonClass) {
  // wait for OK button to be visible
  cy.contains('OK', { timeout: 600000 }).should('be.visible');
  cy.contains('OK').realClick(); // real click mimics user gesture so that fullscreen can start
  taskLoop(correctFlag, buttonClass);
}
