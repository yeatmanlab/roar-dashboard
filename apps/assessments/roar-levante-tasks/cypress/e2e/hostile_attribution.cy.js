import { testAfc } from './helpers.js';

const HA_url = 'http://localhost:8000/?task=hostile-attribution';

// Skipped: hostile-attribution is not wired into the dashboard (no task/variant records
// seeded in the ROAR backend). Re-enable once dashboard support lands.
describe.skip('test hostile attribution', () => {
  it('visits hostile attribution and plays game', () => {
    cy.visit(HA_url);
    testAfc('class', '.image');
  });
});
