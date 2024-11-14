import { playSRE } from '../../../../support/helper-functions/roar-sre/sreHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-sre';

describe('ROAR - Sentence Play Through', () => {
  it('Plays SRE with a simulated 3g connection', () => {
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
