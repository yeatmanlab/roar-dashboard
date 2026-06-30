import { testAfc } from './helpers.js';

const child_survey_url = 'http://localhost:8000/?task=child-survey';

describe.skip('test child survey', () => {
  it('visits child survey and plays game', () => {
    cy.visit(child_survey_url);
    testAfc('none', '.secondary--wide');
  });
});
