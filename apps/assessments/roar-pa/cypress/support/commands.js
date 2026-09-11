// import { timeout, playPA } from './helperFunctions';
import { timeout, playPA, playPASO } from './helperFunctions';

// eslint-disable-next-line no-unused-vars
Cypress.Commands.add('playPA', (startText, breakText, breakTex2, endText, language = 'en', variantParams = null) => {
  // PA needs a large timeout due to asset loading
  if (variantParams) {
    cy.visit(`${Cypress.env('baseUrl')}/?${variantParams}`, { timeout: 3 * timeout });
  } else {
    cy.visit(`${Cypress.env('baseUrl')}`, { timeout: 3 * timeout });
  }

  playPA(startText, breakText, breakTex2, endText);
});

// eslint-disable-next-line no-unused-vars
Cypress.Commands.add('playPASO', (startText, breakText, breakTex2, endText, language = 'en', variantParams = null) => {
  // PA needs a large timeout due to asset loading
  if (variantParams) {
    cy.visit(`${Cypress.env('variantUrl')}/?${variantParams}`, { timeout: 3 * timeout });
  } else {
    cy.visit(`${Cypress.env('variantUrl')}`, { timeout: 3 * timeout });
  }

  playPASO(startText, breakText, breakTex2, endText);
});
