import { TIMEOUT, START_TEXT_DEFAULT, END_TEXT_DEFAULT } from './constants';

const languageOptions = {
  en: {
    continueText: 'Continue',
  },
  es: {
    continueText: 'Continuar',
  },
};

Cypress.Commands.add('playIntro', (language) => {
   
  for (let i = 0; i <= 5; i++) {
    cy.log(i);
    cy.wait(0.3 * TIMEOUT);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 5 * TIMEOUT });
    cy.wait(0.3 * TIMEOUT);
    cy.get('body').type('{leftarrow}{rightarrow}', { timeout: 5 * TIMEOUT });
    cy.wait(0.3 * TIMEOUT);
  }
  cy.wait(0.3 * TIMEOUT);
  cy.get('div', { timeout: 5 * TIMEOUT })
    .contains(languageOptions[language].continueText || languageOptions[language].continueText.toLowerCase())
    .click();
});

Cypress.Commands.add('playSWRBlock', (language, endText) => {
  cy.wait(0.3 * TIMEOUT);
  cy.log('Playing SWR block.');
  cy.get('body', { timeout: 3 * TIMEOUT }).then((body) => {
    if (!body.find('.stimulus').length > 0) {
      cy.get('body', { timeout: 3 * TIMEOUT })
        .invoke('text')
        .then((text) => {
          if (text.includes(endText)) {
            cy.log('End text found, evaluating finishSWR function.');
            cy.finishSWR(endText);
          } else if (
            text.includes(
              languageOptions[language].continueText.toLowerCase() ||
                languageOptions[language].continueText.toLowerCase(),
            )
          ) {
            cy.log('Continue text found, continuing game.');
            cy.get('body', { timeout: TIMEOUT }).type('{leftarrow}');
          } else {
            cy.log('No end text or continue text found, attempting to end game.');
            cy.finishSWR(endText);
          }
        });
      cy.log('Looking for stimulus...');
      cy.get('body', { timeout: 3 * TIMEOUT }).then((_body) => {
        if (!_body.find('.stimulus').length > 0) {
          if (_body.find('.jspsych-btn').length > 0) {
            cy.log('Button found, clicking.');
            cy.get('.jspsych-btn', { timeout: TIMEOUT }).click();
            cy.log('Button clicked, continuing game.');
            cy.playSWRBlock(language, endText);
          } else {
            cy.log('No stimulus found, passing to finishSWR.');
          }
        } else {
          cy.log('Stimulus found, continuing game.');
          cy.playSWRBlock(language, endText);
        }
      });
    } else {
      cy.get('body', { timeout: TIMEOUT }).type('{rightarrow}');
      cy.get('body', { timeout: TIMEOUT }).type('{leftarrow}');
      cy.playSWRBlock(language, endText);
    }
  });
});

Cypress.Commands.add('finishSWR', (endText) => {
  cy.log('No stimulus found, ending game');
  cy.wait(0.2 * TIMEOUT);
  cy.get('body', { timeout: 3 * TIMEOUT })
    .contains(endText, { timeout: 3 * TIMEOUT })
    .should('be.visible');
  cy.log('End prompt found, ending game.');
});

Cypress.Commands.add(
  'playSWR',
  ({ startText = START_TEXT_DEFAULT, endText = END_TEXT_DEFAULT, language = 'en', variantParams = null } = {}) => {
    Cypress.on('uncaught:exception', () => false);
    if (variantParams) {
      //   Navigate to URL including variantParams
      cy.visit(`${Cypress.env('baseUrl')}/?${variantParams}`);
    } else {
      // Play default SWR variant
      cy.visit(Cypress.env('baseUrl'));
    }
    // handles error where full screen throws a permissions error
    cy.wait(0.1 * TIMEOUT);

    Cypress.on('uncaught:exception', () => false);

    cy.get('.jspsych-btn', { timeout: TIMEOUT }).click();
    // play tutorial
    cy.contains(startText, { timeout: TIMEOUT });
     
    for (let i = 0; i < 3; i++) {
      cy.get('body', { timeout: TIMEOUT }).type('{leftarrow}');
    }

    cy.get('.jspsych-btn', { timeout: 10 * TIMEOUT })
      .should('be.visible')
      .click();

    // intro
    cy.playIntro(language);
    // play SWR recursively
    cy.playSWRBlock(language, endText);
    // finish SWR by checking for endText
    cy.finishSWR(endText);
  },
);
