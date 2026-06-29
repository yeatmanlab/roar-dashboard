import { testAfc } from './helpers.cy.js';

const HA_url = 'http://localhost:8000/?task=hostile-attribution';

describe('test hostile attribution', () => {
  it('visits hostile attribution and plays game', () => {
    cy.visit(HA_url);
    testAfc('class', '.image');
  });
});
