import { testAfc } from './helpers.js';

const TOM_url = 'http://localhost:8000/?task=theory-of-mind';

describe('test theory of mind', () => {
  it('visits theory of mind and plays game', () => {
    cy.visit(TOM_url);
    testAfc('class', '.image');
  });
});
