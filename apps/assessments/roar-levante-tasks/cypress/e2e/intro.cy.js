import { instructions } from './helpers.cy.js';

const intro_url = 'http://localhost:8000/?task=intro';

describe('test intro', () => {
  it('visits intro and clicks through instructions', () => {
    cy.visit(intro_url);
    // wait for OK button to be visible
    cy.contains('OK', { timeout: 600000 }).should('be.visible');

    cy.contains('OK').realClick(); // real click mimics user gesture so that fullscreen can start
    instructions();
  });
});
