import { instructions } from './helpers.js';

const intro_url = 'http://localhost:8000/?task=intro';

describe('test intro', () => {
  it('visits intro and clicks through instructions', () => {
    cy.visit(intro_url);
    // Same OK gate and the same allowance as testAfc in helpers.js, which explains the value.
    cy.contains('OK', { timeout: 120000 }).should('be.visible');

    cy.contains('OK').realClick(); // real click mimics user gesture so that fullscreen can start
    instructions();
  });
});
