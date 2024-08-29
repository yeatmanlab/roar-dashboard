import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-swr';

describe('ROAR - Word Play Through', () => {
  it('Plays Word with Clever auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSWR({ auth: 'clever' });
      }
    });
  });
  it('Plays Word with username auth', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSWR({ auth: 'username' });
      }
    });
  });
});
