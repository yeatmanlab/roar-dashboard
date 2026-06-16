import { TIMEOUT, START_TEXT_DEFAULT, END_TEXT_DEFAULT } from './constants';

Cypress.Commands.add('playIntro', ({ startText = START_TEXT_DEFAULT, variantParams = null } = {}) => {
  // handles error where full screen throws a permissions error
  Cypress.on('uncaught:exception', () => false);

  if (variantParams) {
    cy.visit(`${Cypress.env('baseUrl')}/?${variantParams}`, { timeout: 2 * TIMEOUT });
  } else {
    cy.visit(`${Cypress.env('baseUrl')}`, { timeout: 2 * TIMEOUT });
  }

  // Enter fullscreen
  cy.get('.jspsych-btn', { timeout: 5 * TIMEOUT })
    .should('be.visible')
    .click();

  cy.wait(0.2 * TIMEOUT);

  // Consent form is shown unless the consent query parameter is explicitly set to 'false'.
  if (!variantParams?.includes('consent=false')) {
    // Click through consent form
    cy.get('b').contains('I agree').click();
    cy.get('.jspsych-btn', { timeout: TIMEOUT }).should('be.visible').click();
    cy.get('.jspsych-btn', { timeout: TIMEOUT }).should('be.visible').click();
  }

  // Select 6th grade
  cy.get('body', { timeout: TIMEOUT }).type('{6}');

  //  Assert startText is visible
  cy.get('body', { timeout: TIMEOUT }).invoke('text').should('include', startText);

  // Select first avatar
  cy.get('body', { timeout: TIMEOUT }).type('{enter}');
  cy.get('body', { timeout: TIMEOUT }).type('{1}');
});

Cypress.Commands.add('playSRELoop', ({ endText = END_TEXT_DEFAULT } = {}) => {
  //  Recursively check for the end game text to appear; end the game if it appears otherwise click left and right arrow keys
  cy.get('body', { timeout: TIMEOUT })
    .invoke('text')
    .then((text) => {
      if (text.includes(endText)) {
        cy.get('div', { timeout: TIMEOUT }).contains(endText, { timeout: TIMEOUT }).should('be.visible');
        cy.log('Game finished successfully.');
      } else {
        cy.get('body').type('{leftarrow}{rightarrow}', { timeout: TIMEOUT });
        cy.wait(0.1 * TIMEOUT);
        cy.playSRELoop(endText); // Recursive call
      }
    });
});

 
Cypress.Commands.add(
  'playSREGame',
  ({ startText = START_TEXT_DEFAULT, endText = END_TEXT_DEFAULT, variantParams = null } = {}) => {
    cy.playIntro({
      startText: startText,
      variantParams: variantParams,
    });

    cy.playSRELoop(endText);
  },
);
