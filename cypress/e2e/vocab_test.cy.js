import { testAfc } from './helpers.cy.js';

const vocab_url = 'http://localhost:8000/?task=vocab';

describe('test vocab', () => {
  it('visits vocab and plays game', () => {
    cy.visit(vocab_url);
    testAfc('class', '.image-medium');
  });
});
