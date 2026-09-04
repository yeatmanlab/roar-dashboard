import { testAfc } from './helpers.js';

const trog_url = 'http://localhost:8000/?task=trog';
describe('test trog', () => {
  it('visits trog and plays game', () => {
    cy.visit(trog_url);
    testAfc('class', '.image-medium');
  });
});
