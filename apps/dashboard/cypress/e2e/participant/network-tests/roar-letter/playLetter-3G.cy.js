import { playLetter } from '../../../../support/helper-functions/roar-letter/letterHelpers';
import { isCurrentVersion } from '../../../../support/utils';

const app = '@bdelab/roar-letter';

describe('ROAR - Letter Play Through using username authentication', () => {
  it('Plays Letter with username authentication in a simulated 3g connection', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playLetter({ auth: 'username' });
      }
    });
  });
});
