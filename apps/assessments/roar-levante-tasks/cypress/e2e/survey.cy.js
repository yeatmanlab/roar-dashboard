import { testAfc } from './helpers.js';

const child_survey_url = 'http://localhost:8000/?task=child-survey';

// Skipped: child-survey is not wired into the dashboard (no task/variant records
// seeded in the ROAR backend). Re-enable once dashboard support lands.
describe.skip('test child survey', () => {
  it('visits child survey and plays game', () => {
    cy.visit(child_survey_url);
    testAfc('none', '.secondary--wide');
  });
});
