import { testAfc } from './helpers.cy.js';

const math_url = 'http://localhost:8000/?task=egma-math';

describe('test math', () => {
  it('visits math and plays game', () => {
    cy.visit(math_url);
    testAfc('alt', '.secondary, .image-medium, .primary');
  });
});
