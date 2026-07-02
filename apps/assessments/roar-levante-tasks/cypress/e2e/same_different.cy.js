const same_different_url = 'http://localhost:8000/?task=same-different-selection';

let matchedDimensions = []; // stores dimensions that have already been matched
let numSelections = 0; // number of selections made in current set of trials
let phaseCount = 3; // used to count phases of multiAfc (3-card, 4-card, 5-card)
let taskCompleted = false;

// used to find matching images
function checkOverlap(list1, list2) {
  return list1.filter((item) => list2.includes(item));
}

function cleanDimensions(dimensions) {
  if (phaseCount > 3) {
    // 3- or 4-match phase
    dimensions.shift(); // ignore size dimension
  }

  if (dimensions.every((element) => isNaN(Number(element))) && phaseCount > 3) {
    dimensions.push('1');
  }

  const nonWhiteBackgrounds = ['gray', 'black', 'striped'];
  if (checkOverlap(dimensions, nonWhiteBackgrounds).length == 0 && phaseCount > 3) {
    dimensions.push('white');
  }

  return dimensions;
}

describe('test same different selection', () => {
  it('visits SDS and plays game', () => {
    cy.visit(same_different_url);
    // wait for OK button to be visible
    cy.contains('OK', { timeout: 600000 }).should('be.visible');
    cy.contains('OK').realClick(); // real click mimics user gesture so that fullscreen can start
    sdsLoop();
  });
});

function instructions() {
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
          cy.contains('OK').click({ timeout: 60000 });
          return;
        }
      });
    } else {
      return;
    }
  });
}

function singleAfc() {
  cy.get('.jspsych-content').then((content) => {
    const correctAnswer = content.find('.correct');

    if (correctAnswer.length > 0) {
      cy.get('.correct').click();
      return;
    } else {
      return;
    }
  });
}

function multiAfc() {
  cy.get('.jspsych-content').then((content) => {
    const responseButtons = content.find('img');
    const correctAnswer = content.find('.correct'); // correct flag signals a single afc trial
    if (responseButtons.length == 0 || correctAnswer.length > 0) {
      return;
    }
    if (numSelections >= responseButtons.length - 1 || phaseCount < responseButtons.length) {
      // reset on new set of cards
      matchedDimensions = [];
      numSelections = 0;
      phaseCount = responseButtons.length;
    }

    responseButtons.each((i) => {
      let selected = false;
      // get a list of one button's properties
      const firstChoiceProperties = cleanDimensions(responseButtons[i].alt.split('-'));

      // check each response button for overlap with the clicked button's properties
      responseButtons.each((j) => {
        const properties = cleanDimensions(responseButtons[j].alt.split('-'));
        const matches = checkOverlap(properties, firstChoiceProperties); // get all matching dimensions

        // filter out previously selected dimensions
        const validMatches = matches.filter((dimension) => {
          return !matchedDimensions.includes(dimension);
        });

        if (validMatches.length > 0 && j != i) {
          matchedDimensions.push(validMatches[0]); // remember the matched dimension
          responseButtons[i].click();
          responseButtons[j].click();
          numSelections++;
          selected = true;
          return false; // stops the each loop
        }
      });

      if (selected) {
        return false;
      }
    });
    return;
  });
}

function sdsLoop() {
  // wait for fixation cross to go away
  cy.get('.lev-stimulus-container', { timeout: 60000 }).should('exist');

  instructions();
  singleAfc();
  multiAfc();

  cy.get('.lev-stimulus-container')
    .should('not.exist')
    .then(() => {
      if (taskCompleted) {
        return;
      } else {
        sdsLoop();
      }
    });

  return;
}
