import { testAfc } from './helpers.js';

const matrix_reasoning_url = 'http://localhost:8000/?task=matrix-reasoning';

describe('test matrix reasoning', () => {
  it('visits matrix reasoning and plays game', () => {
    cy.visit(matrix_reasoning_url);
    testAfc('class', '.image-matrix');
  });
});
