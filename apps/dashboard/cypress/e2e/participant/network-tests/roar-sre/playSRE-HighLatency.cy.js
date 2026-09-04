import { playSRE } from '../../../../support/helper-functions/roar-sre/sreHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-sre';

// SKIPPED until #1827: assessment play-through tests need reevaluation after monorepo migration
describe.skip('ROAR - Sentence Play Through', () => {
  it('Plays SRE with a simulated high latency connection', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSRE({ auth: 'username' });
      }
    });
  });
});
