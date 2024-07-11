import { playSWR } from '../../../support/helper-functions/roar-swr/swrHelpers.js';
import { isCurrentVersion } from '../../../support/utils';

const app = '@bdelab/roar-swr';

describe('ROAR - Word Play Through with username authentication', () => {
  it('Plays Word', () => {
    cy.wrap(!isCurrentVersion(app)).then((isCurrentVersion) => {
      if (isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSWR({ auth: 'username' });
      }
    });
  });
});

describe('ROAR - Word Play Through with Clever Authentication', () => {
  it('Plays Word', () => {
    cy.wrap(isCurrentVersion(app)).then((isCurrentVersion) => {
      if (!isCurrentVersion) {
        cy.log(`Did not detect a new version of ${app}, skipping test.`);
      } else {
        cy.log(`Detected a new version of ${app}, running test.`);
        playSWR({ auth: 'clever' });
      }
    });
  });
});
